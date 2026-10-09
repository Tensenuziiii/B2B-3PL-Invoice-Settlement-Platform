import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { TripNumberService } from "./trip-number.service";
import { CreateTripDto } from "./dto/create-trip.dto";
import { UpdateTripDto } from "./dto/update-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripNumber: TripNumberService,
  ) {}

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
}
