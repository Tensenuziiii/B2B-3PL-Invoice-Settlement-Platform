import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Vendor } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { tenantStorage } from "../core/tenant/tenant.context";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { ListVendorsQueryDto } from "./dto/list-vendors-query.dto";

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {
    if (!(this.prisma as any).vendor && (this.prisma as any).c?.vendor) {
      Object.defineProperty(this.prisma, "vendor", {
        get: () => (this.prisma as any).c.vendor,
        configurable: true,
      });
    }
  }

  private get vendor(): Prisma.VendorDelegate {
    return ((this.prisma as any).vendor ?? (this.prisma as any).c?.vendor) as Prisma.VendorDelegate;
  }

  async list(query: ListVendorsQueryDto) {
    const orgId = tenantStorage.getStore()?.organizationId;
    const where: Prisma.VendorWhereInput = {
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
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.vendor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      this.vendor.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Vendor> {
    const orgId = tenantStorage.getStore()?.organizationId;
    const vendor = await this.vendor.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
    });
    if (!vendor) throw new NotFoundException("Vendor not found.");
    return vendor;
  }

  async create(dto: CreateVendorDto): Promise<Vendor> {
    const orgId = tenantStorage.getStore()?.organizationId;
    const data: Prisma.VendorUncheckedCreateInput = {
      ...(orgId ? { organizationId: orgId } : {}),
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      gstin: dto.gstin ? dto.gstin.trim().toUpperCase() : null,
      stateCode: dto.stateCode ? dto.stateCode.trim() : null,
      payoutTermsDays: dto.payoutTermsDays ?? 15,
      status: "ACTIVE",
    } as Prisma.VendorUncheckedCreateInput;

    try {
      return await this.vendor.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A vendor with this code already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    await this.get(id);

    const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (dto.status !== undefined && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException("Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED.");
    }

    const data: Prisma.VendorUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.gstin !== undefined) data.gstin = dto.gstin ? dto.gstin.trim().toUpperCase() : null;
    if (dto.stateCode !== undefined) data.stateCode = dto.stateCode ? dto.stateCode.trim() : null;
    if (dto.payoutTermsDays !== undefined) data.payoutTermsDays = dto.payoutTermsDays;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.vendor.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A vendor with this code already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.vendor.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    return { success: true };
  }
}
