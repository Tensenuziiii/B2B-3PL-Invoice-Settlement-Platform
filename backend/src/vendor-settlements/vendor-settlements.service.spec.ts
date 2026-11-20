import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { VendorSettlementsService } from "./vendor-settlements.service";
import { SettlementNumberService } from "./settlement-number.service";
import { RateCardsService } from "../rate-cards/rate-cards.service";
import { PrismaService } from "../prisma/prisma.service";
import * as tenantContext from "../core/tenant/tenant.context";

describe("VendorSettlementsService", () => {
  let service: VendorSettlementsService;
  let mockPrisma: any;
  let mockRateCards: { resolve: jest.Mock };
  let mockSettlementNumbers: { nextSettlementNumber: jest.Mock };
  let mockTx: any;

  const mockTrip = (overrides?: Record<string, any>): any => ({
    id: "trip-1",
    organizationId: "org-123",
    tripNumber: "TRP-202610-0001",
    status: "READY_FOR_BILLING",
    vendorId: "vnd-1",
    routeId: "rte-1",
    odometerStart: 100,
    odometerEnd: 200,
    tripStops: [
      { id: "stop-1", sequence: 1, status: "DELIVERED" },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(tenantContext, "requireTenant").mockReturnValue({
      organizationId: "org-123",
      userId: "usr-123",
    });

    mockTx = {
      trip: {
        findMany: jest.fn(),
      },
      vendorSettlementItem: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      vendorSettlement: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args) => ({
          id: "stl-1",
          settlementNumber: args.data.settlementNumber,
          status: args.data.status,
          total: args.data.total,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: "stl-1",
            status: "SUBMITTED",
            version: 1,
          }),
        ),
      },
    };

    mockPrisma = {
      vendorSettlement: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };

    mockRateCards = {
      resolve: jest.fn().mockResolvedValue({
        rateCardId: "rc-1",
        rateCardName: "Standard Vendor Rates",
        rateCardItemId: "rci-1",
        rateType: "FIXED_TRIP",
        rate: 500000,
      }),
    };

    mockSettlementNumbers = {
      nextSettlementNumber: jest.fn().mockResolvedValue("STL-202610-0001"),
    };

    service = new VendorSettlementsService(
      mockPrisma as unknown as PrismaService,
      mockRateCards as unknown as RateCardsService,
      mockSettlementNumbers as unknown as SettlementNumberService,
    );
  });

  it("1. create() throws when tripIds has duplicates", async () => {
    await expect(
      service.create(
        {
          vendorId: "vnd-1",
          tripIds: ["trip-1", "trip-1"],
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("2. create() throws when a trip is not found", async () => {
    mockTx.trip.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          vendorId: "vnd-1",
          tripIds: ["trip-1"],
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("3. create() throws when a trip is not READY_FOR_BILLING", async () => {
    mockTx.trip.findMany.mockResolvedValue([
      mockTrip({ status: "DELIVERED" }),
    ]);

    await expect(
      service.create(
        {
          vendorId: "vnd-1",
          tripIds: ["trip-1"],
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("4. create() throws when a trip belongs to a different vendor", async () => {
    mockTx.trip.findMany.mockResolvedValue([
      mockTrip({ vendorId: "vnd-other" }),
    ]);

    await expect(
      service.create(
        {
          vendorId: "vnd-1",
          tripIds: ["trip-1"],
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("5. create() throws when vendor rate does not resolve", async () => {
    mockTx.trip.findMany.mockResolvedValue([mockTrip()]);
    mockRateCards.resolve.mockRejectedValue(new Error("Rate not found"));

    await expect(
      service.create(
        {
          vendorId: "vnd-1",
          tripIds: ["trip-1"],
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("6. create() creates settlement + items and returns settlementNumber", async () => {
    mockTx.trip.findMany.mockResolvedValue([mockTrip()]);

    const result = await service.create(
      {
        vendorId: "vnd-1",
        tripIds: ["trip-1"],
        notes: "October settlement",
      },
      "usr-123",
    );

    expect(result).toEqual({
      id: "stl-1",
      settlementNumber: "STL-202610-0001",
      status: "DRAFT",
      totalPaise: 500000,
    });
    expect(mockTx.vendorSettlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-123",
          settlementNumber: "STL-202610-0001",
          vendorId: "vnd-1",
          status: "DRAFT",
          total: 500000,
        }),
      }),
    );
    expect(mockTx.vendorSettlementItem.createMany).toHaveBeenCalledTimes(1);
  });

  it("7. transition() throws ConflictException on stale version", async () => {
    mockTx.vendorSettlement.findFirst.mockResolvedValue({
      id: "stl-1",
      status: "DRAFT",
      version: 1,
    });

    await expect(
      service.submit("stl-1", { version: 0 }),
    ).rejects.toThrow(ConflictException);
  });

  it("8. submit()/approve()/markPaid() chain DRAFT → SUBMITTED → APPROVED → PAID", async () => {
    // 1. Submit (DRAFT -> SUBMITTED)
    mockTx.vendorSettlement.findFirst.mockResolvedValueOnce({
      id: "stl-1",
      status: "DRAFT",
      version: 0,
    });
    mockTx.vendorSettlement.findUniqueOrThrow.mockResolvedValueOnce({
      id: "stl-1",
      status: "SUBMITTED",
      version: 1,
    });

    const submitted = await service.submit("stl-1", { version: 0 });
    expect(submitted.status).toBe("SUBMITTED");

    // 2. Approve (SUBMITTED -> APPROVED)
    mockTx.vendorSettlement.findFirst.mockResolvedValueOnce({
      id: "stl-1",
      status: "SUBMITTED",
      version: 1,
    });
    mockTx.vendorSettlement.findUniqueOrThrow.mockResolvedValueOnce({
      id: "stl-1",
      status: "APPROVED",
      version: 2,
    });

    const approved = await service.approve("stl-1", { version: 1 });
    expect(approved.status).toBe("APPROVED");

    // 3. Mark Paid (APPROVED -> PAID)
    mockTx.vendorSettlement.findFirst.mockResolvedValueOnce({
      id: "stl-1",
      status: "APPROVED",
      version: 2,
    });
    mockTx.vendorSettlement.findUniqueOrThrow.mockResolvedValueOnce({
      id: "stl-1",
      status: "PAID",
      version: 3,
    });

    const paid = await service.markPaid("stl-1", { version: 2 });
    expect(paid.status).toBe("PAID");
  });
});
