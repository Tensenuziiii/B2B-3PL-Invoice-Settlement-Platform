import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditsService } from "./audits.service";
import { tenantStorage } from "../core/tenant/tenant.context";

describe("AuditsService", () => {
  let service: AuditsService;
  let tripFindMany: jest.Mock;
  let tripCount: jest.Mock;
  let tripFindFirst: jest.Mock;

  beforeEach(() => {
    tenantStorage.enterWith({ organizationId: "org-123", userId: "usr-123" });

    tripFindMany = jest.fn().mockResolvedValue([]);
    tripCount = jest.fn().mockResolvedValue(0);
    tripFindFirst = jest.fn().mockResolvedValue(null);

    const mockPrisma = {
      trip: {
        findMany: tripFindMany,
        count: tripCount,
        findFirst: tripFindFirst,
      },
    } as unknown as PrismaService;

    service = new AuditsService(mockPrisma);
  });

  afterEach(() => {
    tenantStorage.disable();
  });

  it("1. queue() returns only AUDIT_PENDING trips (filters where.status)", async () => {
    const mockTrips = [
      { id: "trip-1", tripNumber: "TRP-202610-0001", status: "AUDIT_PENDING" },
    ];
    tripFindMany.mockResolvedValue(mockTrips);
    tripCount.mockResolvedValue(1);

    const result = await service.queue({});

    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AUDIT_PENDING",
          deletedAt: null,
        }),
      }),
    );
    expect(tripCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AUDIT_PENDING",
          deletedAt: null,
        }),
      }),
    );
    expect(result.data).toEqual(mockTrips);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("2. queue() applies search on tripNumber OR lrNumber", async () => {
    tripFindMany.mockResolvedValue([]);
    tripCount.mockResolvedValue(0);

    await service.queue({ search: "TRP-001" });

    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AUDIT_PENDING",
          deletedAt: null,
          OR: [
            { tripNumber: { contains: "TRP-001", mode: "insensitive" } },
            { lrNumber: { contains: "TRP-001", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("3. detail() throws NotFoundException for unknown trip", async () => {
    tripFindFirst.mockResolvedValue(null);

    await expect(service.detail("unknown-id")).rejects.toThrow(NotFoundException);
  });

  it("4. detail() computes summary fields correctly (variance, stopsMissingPods, actualKm)", async () => {
    const mockTrip = {
      id: "trip-123",
      tripNumber: "TRP-202610-0001",
      odometerStart: 1200,
      odometerEnd: 1450,
      tripStops: [
        {
          id: "stop-1",
          expectedCollection: 4000,
          collection: { actualAmount: 3800 },
          podDocuments: [{ id: "pod-1" }],
          qtyMismatchFlag: false,
        },
        {
          id: "stop-2",
          expectedCollection: 6000,
          collection: { actualAmount: 6000 },
          podDocuments: [],
          qtyMismatchFlag: true,
        },
      ],
      tripExpenses: [
        { id: "exp-1", amount: 500 },
        { id: "exp-2", amount: 350 },
      ],
    };

    tripFindFirst.mockResolvedValue(mockTrip);

    const result = await service.detail("trip-123");

    expect(result.trip).toEqual(mockTrip);
    expect(result.summary.expectedCollection).toBe(10000);
    expect(result.summary.actualCollection).toBe(9800);
    expect(result.summary.variance).toBe(-200);
    expect(result.summary.totalExpenses).toBe(850);
    expect(result.summary.stopsTotal).toBe(2);
    expect(result.summary.stopsWithPods).toBe(1);
    expect(result.summary.stopsMissingPods).toBe(1);
    expect(result.summary.stopsWithQtyMismatch).toBe(1);
    expect(result.summary.odometerStart).toBe(1200);
    expect(result.summary.odometerEnd).toBe(1450);
    expect(result.summary.actualKm).toBe(250);
  });
});
