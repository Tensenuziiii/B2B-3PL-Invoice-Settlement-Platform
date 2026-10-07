import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Driver, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDriverDto } from "./dto/create-driver.dto";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { ListDriversQueryDto } from "./dto/list-drivers-query.dto";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListDriversQueryDto) {
    const where: Prisma.DriverWhereInput = { deletedAt: null };

    if (query.active === "true") where.active = true;
    if (query.active === "false") where.active = false;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findFirst({
      where: { id, deletedAt: null },
    });
    if (!driver) throw new NotFoundException("Driver not found.");
    return driver;
  }

  async create(dto: CreateDriverDto): Promise<Driver> {
    const existing = await this.prisma.driver.findFirst({
      where: { phone: dto.phone.trim(), deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A driver with this phone or user link already exists.");
    }

    const data: Prisma.DriverUncheckedCreateInput = {
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      licenseNo: dto.licenseNo?.trim() || null,
      licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
      userId: dto.userId ?? null,
      active: true,
    } as Prisma.DriverUncheckedCreateInput;

    try {
      return await this.prisma.driver.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A driver with this phone or user link already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateDriverDto): Promise<Driver> {
    await this.get(id);

    if (dto.phone !== undefined) {
      const existing = await this.prisma.driver.findFirst({
        where: {
          phone: dto.phone.trim(),
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException("A driver with this phone or user link already exists.");
      }
    }

    const data: Prisma.DriverUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.licenseNo !== undefined) data.licenseNo = dto.licenseNo?.trim() || null;
    if (dto.licenseExpiry !== undefined) {
      data.licenseExpiry = dto.licenseExpiry ? new Date(dto.licenseExpiry) : null;
    }
    if (dto.userId !== undefined) data.userId = dto.userId ?? null;
    if (dto.dutyStatus !== undefined) data.dutyStatus = dto.dutyStatus;
    if (dto.active !== undefined) data.active = dto.active;

    try {
      return await this.prisma.driver.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A driver with this phone or user link already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.prisma.driver.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return { success: true };
  }
}
