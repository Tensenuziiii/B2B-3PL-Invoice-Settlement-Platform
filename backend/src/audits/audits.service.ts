import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditsQueryDto } from "./dto/list-audits-query.dto";

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(query: ListAuditsQueryDto) {
    const where: Prisma.TripWhereInput = {
      status: "AUDIT_PENDING",
      deletedAt: null,
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { tripNumber: { contains: search, mode: "insensitive" } },
        { lrNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        orderBy: { auditRequestedAt: "asc" },
        take: limit,
        skip,
        include: {
          client: { select: { id: true, name: true } },
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, regNo: true } },
          _count: { select: { tripStops: true } },
        },
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async detail(tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      include: {
        client: true,
        driver: true,
        vehicle: true,
        route: true,
        tripStops: {
          orderBy: { sequence: "asc" },
          include: {
            collection: true,
            podDocuments: true,
          },
        },
        tripExpenses: { orderBy: { createdAt: "desc" } },
        eodTally: true,
        auditReviews: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!trip) throw new NotFoundException("Trip not found.");

    const expectedCollection = trip.tripStops.reduce((s, st) => s + (st.expectedCollection ?? 0), 0);
    const actualCollection = trip.tripStops.reduce((s, st) => s + (st.collection?.actualAmount ?? 0), 0);
    const totalExpenses = trip.tripExpenses.reduce((s, e) => s + e.amount, 0);

    const stopsWithPods = trip.tripStops.filter((st) => st.podDocuments.length > 0).length;
    const stopsMissingPods = trip.tripStops.length - stopsWithPods;
    const stopsWithQtyMismatch = trip.tripStops.filter((st) => st.qtyMismatchFlag).length;

    return {
      trip,
      summary: {
        expectedCollection,
        actualCollection,
        variance: actualCollection - expectedCollection,
        totalExpenses,
        stopsTotal: trip.tripStops.length,
        stopsWithPods,
        stopsMissingPods,
        stopsWithQtyMismatch,
        odometerStart: trip.odometerStart,
        odometerEnd: trip.odometerEnd,
        actualKm:
          trip.odometerStart != null && trip.odometerEnd != null
            ? trip.odometerEnd - trip.odometerStart
            : null,
      },
    };
  }
}
