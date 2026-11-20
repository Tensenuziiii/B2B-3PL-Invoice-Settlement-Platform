import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Route } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { tenantStorage } from "../core/tenant/tenant.context";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { ListRoutesQueryDto } from "./dto/list-routes-query.dto";

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {
    if (!(this.prisma as any).route && (this.prisma as any).c?.route) {
      Object.defineProperty(this.prisma, "route", {
        get: () => (this.prisma as any).c.route,
        configurable: true,
      });
    }
  }

  private get route(): Prisma.RouteDelegate {
    return ((this.prisma as any).route ?? (this.prisma as any).c?.route) as Prisma.RouteDelegate;
  }

  async list(query: ListRoutesQueryDto) {
    const orgId = tenantStorage.getStore()?.organizationId;
    const where: Prisma.RouteWhereInput = {
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
    };

    if (query.status) {
      where.status = query.status;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { origin: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.route.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      this.route.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Route> {
    const orgId = tenantStorage.getStore()?.organizationId;
    const route = await this.route.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
    });
    if (!route) throw new NotFoundException("Route not found.");
    return route;
  }

  async create(dto: CreateRouteDto): Promise<Route> {
    const orgId = tenantStorage.getStore()?.organizationId;
    const data: Prisma.RouteUncheckedCreateInput = {
      ...(orgId ? { organizationId: orgId } : {}),
      name: dto.name.trim(),
      origin: dto.origin.trim(),
      destination: dto.destination.trim(),
      expectedKm: dto.expectedKm,
      standardTollEstimate: dto.standardTollEstimate ?? 0,
      status: "ACTIVE",
    } as Prisma.RouteUncheckedCreateInput;

    try {
      return await this.route.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A route with this name already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    await this.get(id);

    const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (dto.status !== undefined && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException("Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED.");
    }

    const data: Prisma.RouteUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.origin !== undefined) data.origin = dto.origin.trim();
    if (dto.destination !== undefined) data.destination = dto.destination.trim();
    if (dto.expectedKm !== undefined) data.expectedKm = dto.expectedKm;
    if (dto.standardTollEstimate !== undefined) data.standardTollEstimate = dto.standardTollEstimate;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.route.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A route with this name already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.route.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    return { success: true };
  }
}
