import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Client, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { ListClientsQueryDto } from "./dto/list-clients-query.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClientsQueryDto) {
    const where: Prisma.ClientWhereInput = { deletedAt: null };

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
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Client> {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException("Client not found.");
    return client;
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const data: Prisma.ClientUncheckedCreateInput = {
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      gstin: dto.gstin ? dto.gstin.trim().toUpperCase() : null,
      stateCode: dto.stateCode ? dto.stateCode.trim() : null,
      paymentTermsDays: dto.paymentTermsDays ?? 30,
      status: "ACTIVE",
    } as Prisma.ClientUncheckedCreateInput;

    try {
      return await this.prisma.client.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A client with this code already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    await this.get(id);

    const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (dto.status !== undefined && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException("Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED.");
    }

    const data: Prisma.ClientUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.gstin !== undefined) data.gstin = dto.gstin ? dto.gstin.trim().toUpperCase() : null;
    if (dto.stateCode !== undefined) data.stateCode = dto.stateCode ? dto.stateCode.trim() : null;
    if (dto.paymentTermsDays !== undefined) data.paymentTermsDays = dto.paymentTermsDays;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.prisma.client.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A client with this code already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.prisma.client.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    return { success: true };
  }
}
