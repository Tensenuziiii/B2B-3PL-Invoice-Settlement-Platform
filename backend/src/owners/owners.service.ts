import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Owner, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { UpdateOwnerDto } from "./dto/update-owner.dto";
import { ListOwnersQueryDto } from "./dto/list-owners-query.dto";

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOwnersQueryDto) {
    const where: Prisma.OwnerWhereInput = { deletedAt: null };

    if (query.active === "true") where.active = true;
    if (query.active === "false") where.active = false;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { pan: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.owner.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          _count: {
            select: { trucks: true, trips: true },
          },
        },
      }),
      this.prisma.owner.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Owner> {
    const owner = await this.prisma.owner.findFirst({
      where: { id, deletedAt: null },
      include: {
        trucks: {
          where: { deletedAt: null },
          select: { id: true, regNo: true, type: true, active: true },
        },
      },
    });
    if (!owner) throw new NotFoundException("Owner not found.");
    return owner;
  }

  async create(dto: CreateOwnerDto): Promise<Owner> {
    const data: Prisma.OwnerUncheckedCreateInput = {
      name: dto.name.trim(),
      partyType: dto.partyType ?? "INDIVIDUAL",
      pan: dto.pan ? dto.pan.trim().toUpperCase() : null,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      active: true,
    } as Prisma.OwnerUncheckedCreateInput;

    try {
      return await this.prisma.owner.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An owner with this name already exists in this organization.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateOwnerDto): Promise<Owner> {
    await this.get(id);

    const data: Prisma.OwnerUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.partyType !== undefined) data.partyType = dto.partyType;
    if (dto.pan !== undefined) data.pan = dto.pan ? dto.pan.trim().toUpperCase() : null;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.active !== undefined) data.active = dto.active;

    try {
      return await this.prisma.owner.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An owner with this name already exists in this organization.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.prisma.owner.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return { success: true };
  }
}
