import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, Trip, TripStop } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RateCardsService } from "../rate-cards/rate-cards.service";
import { InvoiceNumberService } from "./invoice-number.service";
import { GenerateInvoiceDto } from "./dto/generate-invoice.dto";
import { requireTenant } from "../core/tenant/tenant.context";

export type ChargeSnapshot = {
  rateCardId: string;
  rateCardName: string;
  rateCardItemId: string;
  rateType: string;
  rateAmountPaise: number;
  quantity: number;
  quantityUnit: "trip" | "delivery" | "km";
  billingDistanceKm: number | null;
  deliveredStopsCount: number | null;
  gstRatePercent: number;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  resolvedAt: string;
  serviceDate: string;
};

export type ChargeResult = {
  lineAmountPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  snapshot: ChargeSnapshot;
};

const DEFAULT_GST_RATE = 18;
const RATE_TYPE_PRIORITY = ["FIXED_TRIP", "PER_DELIVERY", "PER_KM"] as const;

@Injectable()
export class BillingService {
  constructor(
    private readonly rateCards: RateCardsService,
    private readonly prisma: PrismaService,
    private readonly invoiceNumbers: InvoiceNumberService,
  ) {}

  async calculateTripCharge(
    trip: Trip & { tripStops: TripStop[] },
    onDate: Date,
    gstRatePercent: number = DEFAULT_GST_RATE,
  ): Promise<ChargeResult> {
    if (!trip.clientId) {
      throw new BadRequestException(
        `Trip ${trip.tripNumber} has no client — cannot bill without a counterparty.`,
      );
    }

    if (trip.odometerStart == null || trip.odometerEnd == null) {
      throw new BadRequestException(
        `Trip ${trip.tripNumber} has incomplete odometer readings — cannot bill.`,
      );
    }

    if (trip.odometerEnd < trip.odometerStart) {
      throw new BadRequestException(
        `Trip ${trip.tripNumber} has invalid odometer (end < start).`,
      );
    }

    const billingDistanceKm = trip.odometerEnd - trip.odometerStart;
    const deliveredStopsCount = trip.tripStops.filter((s) => s.status === "DELIVERED").length;

    // Try rate types in priority order — first resolve that succeeds wins
    let resolution: Awaited<ReturnType<RateCardsService["resolve"]>> | null = null;
    let usedRateType: string | null = null;
    let lastError: Error | null = null;

    for (const rateType of RATE_TYPE_PRIORITY) {
      try {
        resolution = await this.rateCards.resolve({
          counterpartyType: "CLIENT",
          counterpartyId: trip.clientId,
          rateType: rateType as any,
          onDate: onDate.toISOString(),
          routeId: trip.routeId ?? undefined,
        });
        usedRateType = rateType;
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }

    if (!resolution || !usedRateType) {
      throw new BadRequestException(
        `No applicable rate card found for client ${trip.clientId} on ${onDate.toISOString()}. ` +
          `Last error: ${lastError?.message ?? "unknown"}.`,
      );
    }

    // Compute line amount based on rate type
    let lineAmountPaise: number;
    let quantity: number;
    let quantityUnit: "trip" | "delivery" | "km";

    switch (usedRateType) {
      case "FIXED_TRIP":
        quantity = 1;
        quantityUnit = "trip";
        lineAmountPaise = resolution.rate;
        break;

      case "PER_DELIVERY":
        if (deliveredStopsCount === 0) {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} has no delivered stops — cannot bill PER_DELIVERY.`,
          );
        }
        quantity = deliveredStopsCount;
        quantityUnit = "delivery";
        lineAmountPaise = deliveredStopsCount * resolution.rate;
        break;

      case "PER_KM":
        if (billingDistanceKm <= 0) {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} has zero billing distance — cannot bill PER_KM.`,
          );
        }
        quantity = billingDistanceKm;
        quantityUnit = "km";
        lineAmountPaise = billingDistanceKm * resolution.rate;
        break;

      default:
        throw new BadRequestException(`Unsupported rate type: ${usedRateType}`);
    }

    const gstAmountPaise = Math.round(lineAmountPaise * (gstRatePercent / 100));
    const totalAmountPaise = lineAmountPaise + gstAmountPaise;

    const snapshot: ChargeSnapshot = {
      rateCardId: resolution.rateCardId,
      rateCardName: resolution.rateCardName,
      rateCardItemId: resolution.rateCardItemId,
      rateType: usedRateType,
      rateAmountPaise: resolution.rate,
      quantity,
      quantityUnit,
      billingDistanceKm: quantityUnit === "km" ? billingDistanceKm : null,
      deliveredStopsCount: quantityUnit === "delivery" ? deliveredStopsCount : null,
      gstRatePercent,
      subtotalPaise: lineAmountPaise,
      gstAmountPaise,
      totalAmountPaise,
      resolvedAt: new Date().toISOString(),
      serviceDate: onDate.toISOString(),
    };

    return {
      lineAmountPaise,
      gstAmountPaise,
      totalAmountPaise,
      snapshot,
    };
  }

  async generateInvoice(
    dto: GenerateInvoiceDto,
    generatedById: string,
  ): Promise<{ id: string; invoiceNumber: string; status: string; totalPaise: number }> {
    const { organizationId } = requireTenant();

    if (dto.tripIds.length !== new Set(dto.tripIds).size) {
      throw new BadRequestException("Duplicate tripIds in request.");
    }

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const gstRate = dto.gstRate ?? DEFAULT_GST_RATE;

    if (periodEnd < periodStart) {
      throw new BadRequestException("periodEnd must be on or after periodStart.");
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Load trips with stops
      const trips = await tx.trip.findMany({
        where: {
          id: { in: dto.tripIds },
          deletedAt: null,
        },
        include: { tripStops: { orderBy: { sequence: "asc" } } },
      });

      if (trips.length !== dto.tripIds.length) {
        const found = new Set(trips.map((t) => t.id));
        const missing = dto.tripIds.filter((id) => !found.has(id));
        throw new BadRequestException(`Trips not found: ${missing.join(", ")}`);
      }

      // 2. Validate every trip
      for (const trip of trips) {
        if (trip.status !== "READY_FOR_BILLING") {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} is in status ${trip.status}, expected READY_FOR_BILLING.`,
          );
        }
        if (trip.clientId !== dto.clientId) {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} belongs to a different client.`,
          );
        }
      }

      // 3. Verify no trip is already on another invoice
      const existingLines = await tx.invoiceLine.findMany({
        where: { tripId: { in: dto.tripIds } },
        select: { tripId: true, invoice: { select: { invoiceNumber: true, status: true } } },
      });
      if (existingLines.length > 0) {
        const used = existingLines
          .map((l) => `${l.tripId} (on ${l.invoice.invoiceNumber}/${l.invoice.status})`)
          .join(", ");
        throw new BadRequestException(`Trips already billed: ${used}`);
      }

      // 4. Calculate charges per trip (this uses RateCardsService which needs to be injected)
      const chargeResults = await Promise.all(
        trips.map((trip) =>
          this.calculateTripCharge(trip as any, issueDate, gstRate),
        ),
      );

      // 5. Sum totals
      const subtotal = chargeResults.reduce((s, r) => s + r.lineAmountPaise, 0);
      const gstAmount = chargeResults.reduce((s, r) => s + r.gstAmountPaise, 0);
      const total = chargeResults.reduce((s, r) => s + r.totalAmountPaise, 0);

      // 6. Generate invoice number (atomic counter)
      const invoiceNumber = await this.invoiceNumbers.nextInvoiceNumber(
        tx,
        organizationId,
        issueDate,
      );

      // 7. Create Invoice header
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          status: "DRAFT",
          clientId: dto.clientId,
          issueDate,
          dueDate,
          periodStart,
          periodEnd,
          subtotal,
          gstRate,
          gstAmount,
          total,
        },
      });

      // 8. Create InvoiceLine rows with snapshots
      await tx.invoiceLine.createMany({
        data: chargeResults.map((r, i) => ({
          organizationId,
          invoiceId: invoice.id,
          tripId: trips[i].id,
          lineAmount: r.lineAmountPaise,
          gstAmount: r.gstAmountPaise,
          totalAmount: r.totalAmountPaise,
          snapshot: r.snapshot as any,
        })),
      });

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalPaise: invoice.total,
      };
    });
  }
}
