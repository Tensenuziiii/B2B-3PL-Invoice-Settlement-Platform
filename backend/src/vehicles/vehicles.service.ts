import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Vehicle } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVehiclesQueryDto) {
    const where: Prisma.VehicleWhereInput = { deletedAt: null };

    if (query.active === "true") where.active = true;
    if (query.active === "false") where.active = false;

    const search = query.search?.trim();
    if (search) {
      where.regNo = { contains: search, mode: "insensitive" };
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found.");
    return vehicle;
  }

  async create(dto: CreateVehicleDto): Promise<Vehicle> {
    const data: Prisma.VehicleUncheckedCreateInput = {
      regNo: dto.regNo.trim().toUpperCase(),
      type: dto.type?.trim() || null,
      capacityKg: dto.capacityKg ?? null,
      currentOdometer: dto.currentOdometer ?? 0,
      active: true,
    } as Prisma.VehicleUncheckedCreateInput;

    try {
      return await this.prisma.vehicle.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A vehicle with this registration number already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    await this.get(id);
    const data: Prisma.VehicleUncheckedUpdateInput = {};
    if (dto.regNo !== undefined) data.regNo = dto.regNo.trim().toUpperCase();
    if (dto.type !== undefined) data.type = dto.type?.trim() || null;
    if (dto.capacityKg !== undefined) data.capacityKg = dto.capacityKg;
    if (dto.currentOdometer !== undefined) data.currentOdometer = dto.currentOdometer;
    if (dto.active !== undefined) data.active = dto.active;

    try {
      return await this.prisma.vehicle.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A vehicle with this registration number already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return { success: true };
  }
}
