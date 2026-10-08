import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CounterpartyType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { tenantStorage } from "../core/tenant/tenant.context";
import { CreateRateCardDto } from "./dto/create-rate-card.dto";
import { UpdateRateCardDto } from "./dto/update-rate-card.dto";
import { AddRateCardItemDto } from "./dto/add-rate-card-item.dto";
import { ListRateCardsQueryDto } from "./dto/list-rate-cards-query.dto";

@Injectable()
export class RateCardsService {
  constructor(private readonly prisma: PrismaService) {
    if (!(this.prisma as any).rateCard && (this.prisma as any).c?.rateCard) {
      Object.defineProperty(this.prisma, "rateCard", {
        get: () => (this.prisma as any).c.rateCard,
        configurable: true,
      });
    }
    if (!(this.prisma as any).rateCardItem && (this.prisma as any).c?.rateCardItem) {
      Object.defineProperty(this.prisma, "rateCardItem", {
        get: () => (this.prisma as any).c.rateCardItem,
        configurable: true,
      });
    }
  }

  private get rateCard(): Prisma.RateCardDelegate {
    return ((this.prisma as any).rateCard ?? (this.prisma as any).c?.rateCard) as Prisma.RateCardDelegate;
  }

  private get rateCardItem(): Prisma.RateCardItemDelegate {
    return ((this.prisma as any).rateCardItem ?? (this.prisma as any).c?.rateCardItem) as Prisma.RateCardItemDelegate;
  }

  async list(query: ListRateCardsQueryDto) {
    const orgId = tenantStorage.getStore()?.organizationId;
    const where: Prisma.RateCardWhereInput = {
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
    };
    if (query.status) where.status = query.status;
    if (query.counterpartyType) where.counterpartyType = query.counterpartyType;
    if (query.clientId) where.clientId = query.clientId;
    if (query.vendorId) where.vendorId = query.vendorId;

    const search = query.search?.trim();
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.rateCard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: { _count: { select: { items: true } } },
      }),
      this.rateCard.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string) {
    const orgId = tenantStorage.getStore()?.organizationId;
    const card = await this.rateCard.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!card) throw new NotFoundException("Rate card not found.");
    return card;
  }

  async create(dto: CreateRateCardDto) {
    // Counterparty validation
    if (dto.counterpartyType === CounterpartyType.CLIENT && !dto.clientId) {
      throw new BadRequestException("clientId is required when counterpartyType is CLIENT.");
    }
    if (dto.counterpartyType === CounterpartyType.VENDOR && !dto.vendorId) {
      throw new BadRequestException("vendorId is required when counterpartyType is VENDOR.");
    }
    if (dto.clientId && dto.vendorId) {
      throw new BadRequestException("Provide clientId or vendorId, not both.");
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("At least one rate card item is required.");
    }

    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (validTo && validTo <= validFrom) {
      throw new BadRequestException("validTo must be after validFrom.");
    }

    const orgId = tenantStorage.getStore()?.organizationId;

    try {
      const data: any = {
        ...(orgId ? { organizationId: orgId } : {}),
        name: dto.name.trim(),
        counterpartyType: dto.counterpartyType,
        clientId: dto.clientId ?? null,
        vendorId: dto.vendorId ?? null,
        validFrom,
        validTo,
        status: "ACTIVE",
        notes: dto.notes?.trim() || null,
        items: {
          create: dto.items.map((item) => ({
            ...(orgId ? { organizationId: orgId } : {}),
            rateType: item.rateType,
            routeId: item.routeId ?? null,
            tripType: item.tripType?.trim() || null,
            serviceType: item.serviceType?.trim() || null,
            rate: item.rate,
            notes: item.notes?.trim() || null,
          })),
        },
      };

      return await this.rateCard.create({
        data,
        include: { items: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A rate card with this name already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRateCardDto) {
    await this.get(id);

    const data: Prisma.RateCardUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    try {
      return await this.rateCard.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A rate card with this name already exists.");
      }
      throw error;
    }
  }

  async addItem(id: string, dto: AddRateCardItemDto) {
    const card = await this.get(id);
    const orgId = tenantStorage.getStore()?.organizationId ?? card.organizationId;
    return this.rateCardItem.create({
      data: {
        rateCardId: id,
        rateType: dto.rateType,
        routeId: dto.routeId ?? null,
        tripType: dto.tripType?.trim() || null,
        serviceType: dto.serviceType?.trim() || null,
        rate: dto.rate,
        notes: dto.notes?.trim() || null,
        organizationId: orgId,
      } as any,
    });
  }

  async deactivate(id: string) {
    await this.get(id);
    await this.rateCard.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    return { success: true };
  }
}
