import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RateCardsService } from "../rate-cards/rate-cards.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { SettlementNumberService } from "./settlement-number.service";
import { GenerateSettlementDto } from "./dto/generate-settlement.dto";
import { SettlementActionDto } from "./dto/settlement-action.dto";
import { ListSettlementsQueryDto } from "./dto/list-settlements-query.dto";

const SETTLEMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED"],
  APPROVED: ["PAID"],
  PAID: [],
};

const RATE_TYPE_PRIORITY = ["FIXED_TRIP", "PER_DELIVERY", "PER_KM"] as const;
const DEFAULT_GST_RATE = 0; // vendor payouts do not have GST line

@Injectable()
export class VendorSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateCards: RateCardsService,
    private readonly settlementNumbers: SettlementNumberService,
  ) {}

  async list(query: ListSettlementsQueryDto) {
    const { organizationId } = requireTenant();
    const where: Prisma.VendorSettlementWhereInput = { organizationId, deletedAt: null };
    if (query.status) where.status = query.status as any;
    if (query.vendorId) where.vendorId = query.vendorId;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { settlementNumber: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.vendorSettlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.vendorSettlement.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string) {
    const { organizationId } = requireTenant();
    const settlement = await this.prisma.vendorSettlement.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        vendor: true,
        items: {
          include: {
            trip: {
              select: {
                id: true,
                tripNumber: true,
                origin: true,
                destination: true,
                deliveredAt: true,
                odometerStart: true,
                odometerEnd: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!settlement) throw new NotFoundException("Vendor settlement not found.");
    return settlement;
  }

  async create(dto: GenerateSettlementDto, generatedById: string) {
    const { organizationId } = requireTenant();

    if (dto.tripIds.length !== new Set(dto.tripIds).size) {
      throw new BadRequestException("Duplicate tripIds in request.");
    }

    return this.prisma.$transaction(async (tx) => {
      const trips = await tx.trip.findMany({
        where: { id: { in: dto.tripIds }, deletedAt: null },
        include: { tripStops: { orderBy: { sequence: "asc" } } },
      });

      if (trips.length !== dto.tripIds.length) {
        const found = new Set(trips.map((t) => t.id));
        const missing = dto.tripIds.filter((id) => !found.has(id));
        throw new BadRequestException(`Trips not found: ${missing.join(", ")}`);
      }

      for (const trip of trips) {
        if (trip.status !== "READY_FOR_BILLING") {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} is in status ${trip.status}, expected READY_FOR_BILLING.`,
          );
        }
        if (trip.vendorId !== dto.vendorId) {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} does not belong to vendor ${dto.vendorId}.`,
          );
        }
        if (trip.odometerStart == null || trip.odometerEnd == null) {
          throw new BadRequestException(
            `Trip ${trip.tripNumber} has incomplete odometer — cannot settle.`,
          );
        }
      }

      const existingItems = await tx.vendorSettlementItem.findMany({
        where: { tripId: { in: dto.tripIds } },
        select: { tripId: true, settlement: { select: { settlementNumber: true } } },
      });
      if (existingItems.length > 0) {
        throw new BadRequestException(
          `Some trips are already settled: ${existingItems.map((i) => i.tripId).join(", ")}`,
        );
      }

      // Resolve rate for each trip
      const lineResults: Array<{ tripId: string; amount: number; snapshot: any }> = [];
      for (const trip of trips) {
        const billingDistanceKm = trip.odometerEnd! - trip.odometerStart!;
        const deliveredStops = trip.tripStops.filter((s) => s.status === "DELIVERED").length;

        let resolution: Awaited<ReturnType<RateCardsService["resolve"]>> | null = null;
        let usedType: string | null = null;
        let lastErr: Error | null = null;
        const onDate = new Date();

        for (const rt of RATE_TYPE_PRIORITY) {
          try {
            resolution = await this.rateCards.resolve({
              counterpartyType: "VENDOR",
              counterpartyId: dto.vendorId,
              rateType: rt as any,
              onDate: onDate.toISOString(),
              routeId: trip.routeId ?? undefined,
            });
            usedType = rt;
            break;
          } catch (e) {
            lastErr = e as Error;
          }
        }

        if (!resolution || !usedType) {
          throw new BadRequestException(
            `No vendor rate card found for vendor ${dto.vendorId} on trip ${trip.tripNumber}. ` +
              `Last error: ${lastErr?.message ?? "unknown"}`,
          );
        }

        let lineAmount: number;
        let quantity: number;
        let quantityUnit: "trip" | "delivery" | "km";

        if (usedType === "FIXED_TRIP") {
          quantity = 1;
          quantityUnit = "trip";
          lineAmount = resolution.rate;
        } else if (usedType === "PER_DELIVERY") {
          if (deliveredStops === 0) {
            throw new BadRequestException(
              `Trip ${trip.tripNumber} has no delivered stops — cannot settle PER_DELIVERY.`,
            );
          }
          quantity = deliveredStops;
          quantityUnit = "delivery";
          lineAmount = deliveredStops * resolution.rate;
        } else {
          if (billingDistanceKm <= 0) {
            throw new BadRequestException(
              `Trip ${trip.tripNumber} has zero distance — cannot settle PER_KM.`,
            );
          }
          quantity = billingDistanceKm;
          quantityUnit = "km";
          lineAmount = billingDistanceKm * resolution.rate;
        }

        lineResults.push({
          tripId: trip.id,
          amount: lineAmount,
          snapshot: {
            rateCardId: resolution.rateCardId,
            rateCardName: resolution.rateCardName,
            rateCardItemId: resolution.rateCardItemId,
            rateType: usedType,
            rateAmountPaise: resolution.rate,
            quantity,
            quantityUnit,
            billingDistanceKm: quantityUnit === "km" ? billingDistanceKm : null,
            deliveredStopsCount: quantityUnit === "delivery" ? deliveredStops : null,
            resolvedAt: onDate.toISOString(),
          },
        });
      }

      const subtotal = lineResults.reduce((s, l) => s + l.amount, 0);
      const total = subtotal;
      const settlementNumber = await this.settlementNumbers.nextSettlementNumber(tx, organizationId);

      const settlement = await tx.vendorSettlement.create({
        data: {
          organizationId,
          settlementNumber,
          vendorId: dto.vendorId,
          status: "DRAFT",
          periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
          subtotal,
          adjustments: 0,
          total,
          notes: dto.notes?.trim() || null,
        },
      });

      await tx.vendorSettlementItem.createMany({
        data: lineResults.map((l) => ({
          organizationId,
          settlementId: settlement.id,
          tripId: l.tripId,
          lineAmount: l.amount,
          snapshot: l.snapshot,
        })),
      });

      return {
        id: settlement.id,
        settlementNumber: settlement.settlementNumber,
        status: settlement.status,
        totalPaise: settlement.total,
      };
    });
  }

  async submit(id: string, dto: SettlementActionDto) {
    return this.transition(id, dto, "SUBMITTED", { submittedAt: new Date() });
  }

  async approve(id: string, dto: SettlementActionDto) {
    return this.transition(id, dto, "APPROVED", { approvedAt: new Date() });
  }

  async markPaid(id: string, dto: SettlementActionDto) {
    return this.transition(id, dto, "PAID", { paidAt: new Date() });
  }

  private async transition(
    id: string,
    dto: SettlementActionDto,
    target: string,
    extra: Record<string, unknown>,
  ) {
    const { organizationId } = requireTenant();
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.vendorSettlement.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!s) throw new NotFoundException("Vendor settlement not found.");

      if (s.version !== dto.version) {
        throw new ConflictException(
          `Stale version. Expected ${dto.version}, found ${s.version}.`,
        );
      }

      const allowed = SETTLEMENT_TRANSITIONS[s.status] ?? [];
      if (!allowed.includes(target)) {
        throw new BadRequestException(`Cannot transition from ${s.status} to ${target}.`);
      }

      const updated = await tx.vendorSettlement.updateMany({
        where: { id, version: dto.version, status: s.status },
        data: { status: target as any, version: { increment: 1 }, ...extra },
      });
      if (updated.count === 0) throw new ConflictException("State changed during update.");

      return tx.vendorSettlement.findUniqueOrThrow({ where: { id } });
    });
  }
}
