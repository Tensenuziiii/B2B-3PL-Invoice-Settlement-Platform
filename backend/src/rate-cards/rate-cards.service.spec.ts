import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CounterpartyType, RateCard, RateType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RateCardsService } from "./rate-cards.service";

describe("RateCardsService", () => {
  let service: RateCardsService;
  let rateCardFindMany: jest.Mock;
  let rateCardCount: jest.Mock;
  let rateCardFindFirst: jest.Mock;
  let rateCardCreate: jest.Mock;
  let rateCardUpdate: jest.Mock;
  let rateCardItemCreate: jest.Mock;

  const mockRateCard: RateCard = {
    id: "rc-123",
    organizationId: "org-123",
    name: "METRO-STD-2026",
    counterpartyType: CounterpartyType.CLIENT,
    clientId: "cli-123",
    vendorId: null,
    validFrom: new Date("2026-04-01T00:00:00.000Z"),
    validTo: null,
    status: "ACTIVE",
    notes: "Standard rate card",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    rateCardFindMany = jest.fn().mockResolvedValue([mockRateCard]);
    rateCardCount = jest.fn().mockResolvedValue(1);
    rateCardFindFirst = jest.fn().mockResolvedValue(mockRateCard);
    rateCardCreate = jest.fn().mockResolvedValue(mockRateCard);
    rateCardUpdate = jest.fn().mockResolvedValue(mockRateCard);
    rateCardItemCreate = jest.fn().mockResolvedValue({ id: "rci-123" });

    service = new RateCardsService({
      rateCard: {
        findMany: rateCardFindMany,
        count: rateCardCount,
        findFirst: rateCardFindFirst,
        create: rateCardCreate,
        update: rateCardUpdate,
      },
      rateCardItem: {
        create: rateCardItemCreate,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by status", async () => {
    const result = await service.list({ status: "ACTIVE" });

    expect(rateCardFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        _count: { select: { items: true } },
        client: { select: { id: true, name: true, code: true } },
        vendor: { select: { id: true, name: true, code: true } },
      },
    });
    expect(rateCardCount).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    expect(result.data).toEqual([mockRateCard]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() filters by counterpartyType", async () => {
    await service.list({ counterpartyType: CounterpartyType.CLIENT });

    expect(rateCardFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, counterpartyType: CounterpartyType.CLIENT },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        _count: { select: { items: true } },
        client: { select: { id: true, name: true, code: true } },
        vendor: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it("create() throws when CLIENT type missing clientId", async () => {
    await expect(
      service.create({
        name: "Test Rate Card",
        counterpartyType: CounterpartyType.CLIENT,
        validFrom: "2026-04-01",
        items: [{ rateType: RateType.FIXED_TRIP, rate: 1000 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("create() throws when VENDOR type missing vendorId", async () => {
    await expect(
      service.create({
        name: "Test Rate Card",
        counterpartyType: CounterpartyType.VENDOR,
        validFrom: "2026-04-01",
        items: [{ rateType: RateType.FIXED_TRIP, rate: 1000 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("create() throws when both clientId and vendorId provided", async () => {
    await expect(
      service.create({
        name: "Test Rate Card",
        counterpartyType: CounterpartyType.CLIENT,
        clientId: "00000000-0000-0000-0000-000000000001",
        vendorId: "00000000-0000-0000-0000-000000000002",
        validFrom: "2026-04-01",
        items: [{ rateType: RateType.FIXED_TRIP, rate: 1000 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("create() throws when items array is empty", async () => {
    await expect(
      service.create({
        name: "Test Rate Card",
        counterpartyType: CounterpartyType.CLIENT,
        clientId: "00000000-0000-0000-0000-000000000001",
        validFrom: "2026-04-01",
        items: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("create() throws when validTo <= validFrom", async () => {
    await expect(
      service.create({
        name: "Test Rate Card",
        counterpartyType: CounterpartyType.CLIENT,
        clientId: "00000000-0000-0000-0000-000000000001",
        validFrom: "2026-04-01",
        validTo: "2026-03-31",
        items: [{ rateType: RateType.FIXED_TRIP, rate: 1000 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("get() throws NotFoundException", async () => {
    rateCardFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("resolve() throws NotFoundException when no card exists for counterparty", async () => {
    rateCardFindMany.mockResolvedValue([]);

    await expect(
      service.resolve({
        counterpartyType: CounterpartyType.CLIENT,
        counterpartyId: "cli-123",
        rateType: RateType.FIXED_TRIP,
        onDate: "2026-06-15",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("resolve() throws NotFoundException when card exists but no item matches rateType", async () => {
    rateCardFindMany.mockResolvedValue([{ ...mockRateCard, items: [] }]);

    await expect(
      service.resolve({
        counterpartyType: CounterpartyType.CLIENT,
        counterpartyId: "cli-123",
        rateType: RateType.FIXED_TRIP,
        onDate: "2026-06-15",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("resolve() returns the generic fallback item when no scoped item exists", async () => {
    const genericItem = {
      id: "item-generic",
      rateType: RateType.FIXED_TRIP,
      rate: 2000,
      routeId: null,
      tripType: null,
      serviceType: null,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    };
    rateCardFindMany.mockResolvedValue([{ ...mockRateCard, items: [genericItem] }]);

    const result = await service.resolve({
      counterpartyType: CounterpartyType.CLIENT,
      counterpartyId: "cli-123",
      rateType: RateType.FIXED_TRIP,
      onDate: "2026-06-15",
    });

    expect(result).toEqual({
      rateCardId: "rc-123",
      rateCardName: "METRO-STD-2026",
      rateCardItemId: "item-generic",
      rateType: RateType.FIXED_TRIP,
      rate: 2000,
      routeId: null,
      tripType: null,
      serviceType: null,
      score: 0,
    });
  });

  it("resolve() prefers route+tripType+serviceType over generic (score 3 > 0)", async () => {
    const genericItem = {
      id: "item-generic",
      rateType: RateType.FIXED_TRIP,
      rate: 2000,
      routeId: null,
      tripType: null,
      serviceType: null,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    };
    const specificItem = {
      id: "item-specific",
      rateType: RateType.FIXED_TRIP,
      rate: 3500,
      routeId: "route-1",
      tripType: "FTL",
      serviceType: "EXPRESS",
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
    };
    rateCardFindMany.mockResolvedValue([{ ...mockRateCard, items: [genericItem, specificItem] }]);

    const result = await service.resolve({
      counterpartyType: CounterpartyType.CLIENT,
      counterpartyId: "cli-123",
      rateType: RateType.FIXED_TRIP,
      onDate: "2026-06-15",
      routeId: "route-1",
      tripType: "FTL",
      serviceType: "EXPRESS",
    });

    expect(result.rateCardItemId).toBe("item-specific");
    expect(result.score).toBe(3);
    expect(result.rate).toBe(3500);
  });

  it("resolve() throws BadRequestException when onDate is invalid", async () => {
    await expect(
      service.resolve({
        counterpartyType: CounterpartyType.CLIENT,
        counterpartyId: "cli-123",
        rateType: RateType.FIXED_TRIP,
        onDate: "not-a-valid-date",
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
