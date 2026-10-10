import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, Trip, TripStop } from "@prisma/client";
import { RateCardsService } from "../rate-cards/rate-cards.service";

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
  constructor(private readonly rateCards: RateCardsService) {}

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
}
