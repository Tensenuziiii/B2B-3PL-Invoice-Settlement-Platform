import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { TripNumberService } from "./trip-number.service";
import { CreateTripDto } from "./dto/create-trip.dto";
import { UpdateTripDto } from "./dto/update-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";
import { TripActionDto } from "./dto/trip-action.dto";
import { EndTripDto } from "./dto/end-trip.dto";
import { ArriveStopDto } from "./dto/arrive-stop.dto";
import { AuditTripDto } from "./dto/audit-trip.dto";
import { CompleteStopDto } from "./dto/complete-stop.dto";
import { RecordCollectionDto } from "./dto/record-collection.dto";
import { RecordExpenseDto } from "./dto/record-expense.dto";
import { EodCloseDto } from "./dto/eod-close.dto";

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripNumber: TripNumberService,
  ) {}

  private async loadTripForAction(tx: Prisma.TransactionClient, id: string) {
    const trip = await tx.trip.findFirst({
      where: { id, deletedAt: null },
      include: { driver: true },
    });
    if (!trip) throw new NotFoundException("Trip not found.");
    return trip;
  }

  private assertVersion(trip: { version: number }, expected: number) {
    if (trip.version !== expected) {
      throw new ConflictException(
        `Trip was modified by someone else. Expected version ${expected}, found ${trip.version}.`,
      );
    }
  }

  private assertActorCanActOnTrip(
    trip: { driverId: string | null; driver?: { userId: string | null } | null },
    user: { sub: string; role: string },
  ) {
    if (user.role === "DRIVER") {
      if (!trip.driver || trip.driver.userId !== user.sub) {
        throw new ForbiddenException("You can only act on trips assigned to you.");
      }
    }
  }

  async list(query: ListTripsQueryDto) {
    const where: Prisma.TripWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as any;
    if (query.clientId) where.clientId = query.clientId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { tripNumber: { contains: search, mode: "insensitive" } },
        { lrNumber: { contains: search, mode: "insensitive" } },
        { origin: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          client: { select: { id: true, name: true, code: true } },
          driver: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, regNo: true } },
          tripStops: { orderBy: { sequence: "asc" } },
          _count: { select: { tripStops: true } },
        },
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async getCurrentTripForDriver(userId: string) {
    // Find the Driver profile linked to this user
    const driver = await this.prisma.driver.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      // User has DRIVER role but no Driver profile — return null
      return { data: null };
    }

    // Find the active trip: status is one of the in-progress states
    const trip = await this.prisma.trip.findFirst({
      where: {
        driverId: driver.id,
        deletedAt: null,
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "DELIVERY_IN_PROGRESS", "DELIVERED"],
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, code: true } },
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, regNo: true } },
        tripStops: {
          orderBy: { sequence: "asc" },
          include: {
            podDocuments: true,
            collection: true,
          },
        },
      },
    });

    return { data: trip };
  }

  async get(id: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        driver: true,
        vehicle: true,
        tripStops: {
          orderBy: { sequence: "asc" },
          include: {
            collection: true,
            podDocuments: true,
          },
        },
      },
    });
    if (!trip) throw new NotFoundException("Trip not found.");
    return trip;
  }

  async create(dto: CreateTripDto) {
    if (!dto.stops || dto.stops.length === 0) {
      throw new BadRequestException("At least one trip stop is required.");
    }
    if (dto.clientId && dto.vendorId) {
      throw new BadRequestException("Provide clientId or vendorId, not both.");
    }

    const { organizationId } = requireTenant();

    return this.prisma.$transaction(
      async (tx) => {
      const tripNumber = await this.tripNumber.nextTripNumber(tx, organizationId);

      const stopsData = dto.stops.map((s, idx) => ({
        organizationId,
        sequence: s.sequence ?? idx + 1,
        name: s.name.trim(),
        address: s.address?.trim() || null,
        expectedQty: s.expectedQty ?? null,
        collectionType: s.collectionType ?? "COD",
        expectedCollection: s.expectedCollection ?? 0,
      }));

      return tx.trip.create({
        data: {
          organizationId,
          tripNumber,
          clientId: dto.clientId ?? null,
          vendorId: dto.vendorId ?? null,
          routeId: dto.routeId ?? null,
          driverId: dto.driverId ?? null,
          vehicleId: dto.vehicleId ?? null,
          origin: dto.origin?.trim() || null,
          destination: dto.destination?.trim() || null,
          lrNumber: dto.lrNumber?.trim() || null,
          eta: dto.eta ? new Date(dto.eta) : null,
          odometerStart: dto.odometerStart ?? null,
          status: "ASSIGNED",
          tripStops: {
            create: stopsData,
          },
        },
        include: {
          client: { select: { id: true, name: true } },
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, regNo: true } },
          tripStops: { orderBy: { sequence: "asc" } },
        },
      });
    },
    { timeout: 20000, maxWait: 10000 },
  );
  }

  async update(id: string, dto: UpdateTripDto) {
    const trip = await this.get(id);

    if (trip.status !== "ASSIGNED") {
      throw new BadRequestException("Trip can only be edited while in ASSIGNED state.");
    }

    const data: Prisma.TripUncheckedUpdateInput = {};
    if (dto.driverId !== undefined) data.driverId = dto.driverId;
    if (dto.vehicleId !== undefined) data.vehicleId = dto.vehicleId;
    if (dto.routeId !== undefined) data.routeId = dto.routeId;
    if (dto.origin !== undefined) data.origin = dto.origin?.trim() || null;
    if (dto.destination !== undefined) data.destination = dto.destination?.trim() || null;
    if (dto.lrNumber !== undefined) data.lrNumber = dto.lrNumber?.trim() || null;
    if (dto.eta !== undefined) data.eta = new Date(dto.eta);

    return this.prisma.trip.update({
      where: { id },
      data,
      include: { tripStops: { orderBy: { sequence: "asc" } } },
    });
  }

  async softDelete(id: string) {
    const trip = await this.get(id);
    if (trip.status !== "ASSIGNED") {
      throw new BadRequestException("Only trips in ASSIGNED state can be deleted.");
    }
    await this.prisma.trip.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ASSIGNED" as any },
    });
    return { success: true };
  }

  async startTrip(id: string, dto: TripActionDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);
        this.assertActorCanActOnTrip(trip, user);

        if (trip.status !== "ASSIGNED") {
          throw new BadRequestException(`Cannot start a trip in ${trip.status} state.`);
        }
        if (!trip.driverId) {
          throw new BadRequestException("Trip has no driver assigned.");
        }
        if (!trip.vehicleId) {
          throw new BadRequestException("Trip has no vehicle assigned.");
        }

        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "ASSIGNED" },
          data: {
            status: "IN_PROGRESS",
            version: { increment: 1 },
            startedAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }
        return tx.trip.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async arriveAtStop(id: string, dto: ArriveStopDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);
        this.assertActorCanActOnTrip(trip, user);

        if (trip.status !== "IN_PROGRESS" && trip.status !== "DELIVERY_IN_PROGRESS") {
          throw new BadRequestException(`Cannot arrive at stop while trip is ${trip.status}.`);
        }

        const stop = await tx.tripStop.findFirst({
          where: { id: dto.tripStopId, tripId: id },
        });
        if (!stop) throw new NotFoundException("Trip stop not found.");
        if (stop.status !== "PENDING") {
          throw new BadRequestException(`Stop is already in ${stop.status} state.`);
        }

        await tx.tripStop.update({
          where: { id: stop.id },
          data: { status: "IN_PROGRESS" },
        });

        // If this is the first arrival, transition trip to DELIVERY_IN_PROGRESS
        if (trip.status === "IN_PROGRESS") {
          const updated = await tx.trip.updateMany({
            where: { id, version: dto.version, status: "IN_PROGRESS" },
            data: {
              status: "DELIVERY_IN_PROGRESS",
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            throw new ConflictException("Trip state changed during update.");
          }
        } else {
          // Just bump version
          await tx.trip.update({
            where: { id },
            data: { version: { increment: 1 } },
          });
        }

        return tx.trip.findUniqueOrThrow({
          where: { id },
          include: { tripStops: { orderBy: { sequence: "asc" } } },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async endTrip(id: string, dto: EndTripDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);
        this.assertActorCanActOnTrip(trip, user);

        if (trip.status !== "DELIVERY_IN_PROGRESS") {
          throw new BadRequestException(`Cannot end a trip in ${trip.status} state.`);
        }
        if (trip.odometerStart == null) {
          throw new BadRequestException("Trip has no odometerStart recorded.");
        }
        if (dto.odometerEnd < trip.odometerStart) {
          throw new BadRequestException(
            `odometerEnd (${dto.odometerEnd}) cannot be less than odometerStart (${trip.odometerStart}).`,
          );
        }

        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "DELIVERY_IN_PROGRESS" },
          data: {
            status: "DELIVERED",
            version: { increment: 1 },
            odometerEnd: dto.odometerEnd,
            deliveredAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }
        return tx.trip.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async closeTrip(id: string, dto: TripActionDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);

        if (trip.status !== "DELIVERED") {
          throw new BadRequestException(`Cannot close a trip in ${trip.status} state.`);
        }

        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "DELIVERED" },
          data: {
            status: "AUDIT_PENDING",
            version: { increment: 1 },
            auditRequestedAt: new Date(),
            closedAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }
        return tx.trip.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async auditTrip(id: string, dto: AuditTripDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);

        if (trip.status !== "AUDIT_PENDING") {
          throw new BadRequestException(`Cannot audit a trip in ${trip.status} state.`);
        }

        const newStatus = dto.outcome === "AUDITED" ? "AUDITED" : "CORRECTION_REQUESTED";
        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "AUDIT_PENDING" },
          data: {
            status: newStatus,
            version: { increment: 1 },
            ...(dto.outcome === "AUDITED" ? { auditedAt: new Date() } : {}),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }

        const { organizationId } = requireTenant();
        await tx.auditReview.create({
          data: {
            organizationId,
            tripId: id,
            reviewerId: user.sub,
            outcome: dto.outcome,
            notes: dto.notes,
            checklist: dto.checklist ?? undefined,
          } as any,
        });

        return tx.trip.findUniqueOrThrow({
          where: { id },
          include: { auditReviews: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async resubmitForAudit(id: string, dto: TripActionDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);

        if (trip.status !== "CORRECTION_REQUESTED") {
          throw new BadRequestException(`Cannot resubmit a trip in ${trip.status} state.`);
        }

        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "CORRECTION_REQUESTED" },
          data: {
            status: "AUDIT_PENDING",
            version: { increment: 1 },
            auditRequestedAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }
        return tx.trip.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async markReadyForBilling(id: string, dto: TripActionDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);

        if (trip.status !== "AUDITED") {
          throw new BadRequestException(`Cannot mark ready for billing a trip in ${trip.status} state.`);
        }

        const updated = await tx.trip.updateMany({
          where: { id, version: dto.version, status: "AUDITED" },
          data: {
            status: "READY_FOR_BILLING",
            version: { increment: 1 },
            readyForBillingAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new ConflictException("Trip state changed during update.");
        }
        return tx.trip.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async completeStop(id: string, stopId: string, dto: CompleteStopDto, user: { sub: string; role: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await this.loadTripForAction(tx, id);
        this.assertVersion(trip, dto.version);
        this.assertActorCanActOnTrip(trip, user);

        if (trip.status !== "IN_PROGRESS" && trip.status !== "DELIVERY_IN_PROGRESS") {
          throw new BadRequestException(`Cannot complete stop while trip is ${trip.status}.`);
        }

        const stop = await tx.tripStop.findFirst({
          where: { id: stopId, tripId: id },
          include: { podDocuments: true },
        });
        if (!stop) throw new NotFoundException("Trip stop not found.");
        if (stop.status === "DELIVERED") {
          throw new BadRequestException("Stop is already completed.");
        }
        if (stop.podDocuments.length === 0) {
          throw new BadRequestException("A POD document is required before completing the stop.");
        }

        const deliveredQty = dto.deliveredQty ?? stop.expectedQty ?? null;
        const qtyMismatch =
          stop.expectedQty != null && deliveredQty != null && deliveredQty !== stop.expectedQty;

        await tx.tripStop.update({
          where: { id: stopId },
          data: {
            status: "DELIVERED",
            deliveredQty,
            qtyMismatchFlag: qtyMismatch,
          },
        });

        await tx.trip.update({
          where: { id },
          data: { version: { increment: 1 } },
        });

        return tx.trip.findUniqueOrThrow({
          where: { id },
          include: { tripStops: { orderBy: { sequence: "asc" }, include: { podDocuments: true, collection: true } } },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }

  async recordCollection(id: string, dto: RecordCollectionDto, user: { sub: string; role: string }) {
    const { organizationId } = requireTenant();

    const trip = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!trip) throw new NotFoundException("Trip not found.");
    if (trip.status === "READY_FOR_BILLING") {
      throw new BadRequestException("Cannot record collection on a closed trip.");
    }

    const stop = await this.prisma.tripStop.findFirst({ where: { id: dto.tripStopId, tripId: id } });
    if (!stop) throw new NotFoundException("Trip stop not found.");

    const existing = await this.prisma.collection.findFirst({ where: { tripStopId: dto.tripStopId } });
    if (existing) {
      throw new BadRequestException("A collection is already recorded for this stop. Use update instead.");
    }

    return this.prisma.collection.create({
      data: {
        organizationId,
        tripStopId: dto.tripStopId,
        actualAmount: dto.actualAmount,
        mode: dto.mode,
        referenceId: dto.referenceId?.trim() || null,
        notes: dto.notes?.trim() || null,
        recordedById: user.sub,
      },
    });
  }

  async listCollections(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!trip) throw new NotFoundException("Trip not found.");

    return this.prisma.collection.findMany({
      where: { tripStop: { tripId: id } },
      include: { tripStop: { select: { id: true, sequence: true, name: true, expectedCollection: true } } },
      orderBy: { collectedAt: "desc" },
    });
  }

  async recordExpense(id: string, dto: RecordExpenseDto, user: { sub: string; role: string }) {
    const { organizationId } = requireTenant();

    const trip = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!trip) throw new NotFoundException("Trip not found.");
    if (trip.status === "READY_FOR_BILLING") {
      throw new BadRequestException("Cannot add expense to a closed trip.");
    }

    return this.prisma.tripExpense.create({
      data: {
        organizationId,
        tripId: id,
        type: dto.type,
        amount: dto.amount,
        receiptRef: dto.receiptRef?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });
  }

  async listExpenses(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!trip) throw new NotFoundException("Trip not found.");

    return this.prisma.tripExpense.findMany({
      where: { tripId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSummary(id: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, deletedAt: null },
      include: {
        tripStops: { include: { collection: true } },
        tripExpenses: true,
      },
    });
    if (!trip) throw new NotFoundException("Trip not found.");

    const expectedCollection = trip.tripStops.reduce((s, st) => s + (st.expectedCollection ?? 0), 0);
    const actualCollection = trip.tripStops.reduce((s, st) => s + (st.collection?.actualAmount ?? 0), 0);
    const totalExpenses = trip.tripExpenses.reduce((s, e) => s + e.amount, 0);
    const stopsTotal = trip.tripStops.length;
    const stopsDelivered = trip.tripStops.filter((s) => s.status === "DELIVERED").length;

    return {
      tripId: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      stopsTotal,
      stopsDelivered,
      expectedCollection,
      actualCollection,
      variance: actualCollection - expectedCollection,
      totalExpenses,
      odometerStart: trip.odometerStart,
      odometerEnd: trip.odometerEnd,
      actualKm:
        trip.odometerStart != null && trip.odometerEnd != null
          ? trip.odometerEnd - trip.odometerStart
          : null,
    };
  }

  async closeEod(id: string, dto: EodCloseDto, user: { sub: string; role: string }) {
    const { organizationId } = requireTenant();

    return this.prisma.$transaction(async (tx) => {
      const trip = await this.loadTripForAction(tx, id);
      this.assertVersion(trip, dto.version);

      if (trip.status !== "DELIVERED") {
        throw new BadRequestException(`Cannot close EOD while trip is ${trip.status}.`);
      }

      const existing = await tx.eodTally.findFirst({ where: { tripId: id } });
      if (existing) {
        throw new BadRequestException("EOD for this trip is already closed.");
      }

      const stops = await tx.tripStop.findMany({
        where: { tripId: id },
        include: { collection: true },
      });

      const expenses = await tx.tripExpense.findMany({ where: { tripId: id } });

      const sumByType = (t: string) =>
        expenses.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);

      const toll = sumByType("TOLL");
      const fuel = sumByType("FUEL") + sumByType("EMERGENCY_FUEL");
      const allowance = sumByType("DRIVER_ALLOWANCE");
      const actualCash = stops.reduce((s, st) => s + (st.collection?.actualAmount ?? 0), 0);
      const netExpected = stops.reduce((s, st) => s + (st.expectedCollection ?? 0), 0);
      const discrepancy = actualCash - netExpected;

      const tally = await tx.eodTally.create({
        data: {
          organizationId,
          tripId: id,
          toll,
          fuel,
          allowance,
          actualCash,
          netExpected,
          discrepancy,
        },
      });

      // Bump trip version (status remains DELIVERED — next transition is closeTrip to AUDIT_PENDING)
      await tx.trip.update({
        where: { id },
        data: { version: { increment: 1 } },
      });

      return tally;
    });
  }

  async getEod(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!trip) throw new NotFoundException("Trip not found.");

    const tally = await this.prisma.eodTally.findFirst({ where: { tripId: id } });
    if (!tally) throw new NotFoundException("EOD has not been closed for this trip.");
    return tally;
  }
}
