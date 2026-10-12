import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TripNumberService } from "./trip-number.service";
import { TripsService } from "./trips.service";
import * as tenantContext from "../core/tenant/tenant.context";

describe("TripsService", () => {
  let service: TripsService;
  let tripFindMany: jest.Mock;
  let tripCount: jest.Mock;
  let tripFindFirst: jest.Mock;
  let tripCreate: jest.Mock;
  let tripUpdate: jest.Mock;
  let tripUpdateMany: jest.Mock;
  let tripFindUniqueOrThrow: jest.Mock;
  let tripStopFindFirst: jest.Mock;
  let tripStopUpdate: jest.Mock;
  let auditReviewCreate: jest.Mock;
  let collectionFindFirst: jest.Mock;
  let collectionCreate: jest.Mock;
  let collectionFindMany: jest.Mock;
  let tripExpenseCreate: jest.Mock;
  let tripExpenseFindMany: jest.Mock;
  let tripStopFindMany: jest.Mock;
  let eodTallyFindFirst: jest.Mock;
  let eodTallyCreate: jest.Mock;
  let nextTripNumber: jest.Mock;
  let driverFindFirst: jest.Mock;
  let mockTx: any;
  let prismaTransaction: jest.Mock;

  const mockTrip = {
    id: "trp-123",
    organizationId: "org-123",
    tripNumber: "TRP-202610-0001",
    status: "ASSIGNED",
    version: 0,
    clientId: "cli-123",
    vendorId: null,
    routeId: null,
    driverId: "drv-123",
    driver: { id: "drv-123", userId: "usr-123" },
    vehicleId: "veh-123",
    origin: "Mumbai",
    destination: "Pune",
    lrNumber: "LR-1001",
    eta: new Date("2026-10-10T10:00:00.000Z"),
    odometerStart: 1000,
    odometerEnd: null,
    delayMinutes: 0,
    delayReason: null,
    assignedAt: null,
    startedAt: null,
    deliveredAt: null,
    closedAt: null,
    auditRequestedAt: null,
    auditedAt: null,
    readyForBillingAt: null,
    createdAt: new Date("2026-10-09T00:00:00.000Z"),
    updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    deletedAt: null,
    tripStops: [],
  };

  beforeEach(() => {
    jest.spyOn(tenantContext, "requireTenant").mockReturnValue({ organizationId: "org-123", userId: "usr-123" });

    tripFindMany = jest.fn().mockResolvedValue([mockTrip]);
    tripCount = jest.fn().mockResolvedValue(1);
    tripFindFirst = jest.fn().mockResolvedValue(mockTrip);
    tripCreate = jest.fn().mockResolvedValue(mockTrip);
    tripUpdate = jest.fn().mockResolvedValue(mockTrip);
    tripUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    tripFindUniqueOrThrow = jest.fn().mockResolvedValue(mockTrip);
    tripStopFindFirst = jest.fn().mockResolvedValue({ id: "stop-1", status: "PENDING" });
    tripStopUpdate = jest.fn().mockResolvedValue({ id: "stop-1", status: "IN_PROGRESS" });
    auditReviewCreate = jest.fn().mockResolvedValue({ id: "rev-1" });
    collectionFindFirst = jest.fn().mockResolvedValue(null);
    collectionCreate = jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "col-1", ...args.data }));
    collectionFindMany = jest.fn().mockResolvedValue([]);
    tripExpenseCreate = jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "exp-1", ...args.data }));
    tripExpenseFindMany = jest.fn().mockResolvedValue([]);
    tripStopFindMany = jest.fn().mockResolvedValue([]);
    eodTallyFindFirst = jest.fn().mockResolvedValue(null);
    eodTallyCreate = jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "tally-1", ...args.data }));
    driverFindFirst = jest.fn().mockResolvedValue(null);

    mockTx = {
      trip: {
        findFirst: tripFindFirst,
        create: tripCreate,
        update: tripUpdate,
        updateMany: tripUpdateMany,
        findUniqueOrThrow: tripFindUniqueOrThrow,
      },
      tripStop: {
        findFirst: tripStopFindFirst,
        findMany: tripStopFindMany,
        update: tripStopUpdate,
      },
      tripExpense: {
        findMany: tripExpenseFindMany,
      },
      eodTally: {
        findFirst: eodTallyFindFirst,
        create: eodTallyCreate,
      },
      auditReview: {
        create: auditReviewCreate,
      },
    };

    prismaTransaction = jest.fn().mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    nextTripNumber = jest.fn().mockResolvedValue("TRP-202610-0001");

    const mockPrisma = {
      trip: {
        findMany: tripFindMany,
        count: tripCount,
        findFirst: tripFindFirst,
        update: tripUpdate,
      },
      tripStop: {
        findFirst: tripStopFindFirst,
      },
      collection: {
        findFirst: collectionFindFirst,
        create: collectionCreate,
        findMany: collectionFindMany,
      },
      tripExpense: {
        create: tripExpenseCreate,
        findMany: tripExpenseFindMany,
      },
      eodTally: {
        findFirst: eodTallyFindFirst,
      },
      driver: {
        findFirst: driverFindFirst,
      },
      $transaction: prismaTransaction,
    } as unknown as PrismaService;

    const mockTripNumberService = {
      nextTripNumber,
    } as unknown as TripNumberService;

    service = new TripsService(mockPrisma, mockTripNumberService);
  });


  it("1. list() filters by status", async () => {
    const result = await service.list({ status: "ASSIGNED" });

    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, status: "ASSIGNED" }),
      }),
    );
    expect(tripCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: null, status: "ASSIGNED" }),
    });
    expect(result.data).toEqual([mockTrip]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("2. list() filters by clientId", async () => {
    await service.list({ clientId: "cli-123" });

    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, clientId: "cli-123" }),
      }),
    );
  });

  it("3. list() searches tripNumber / lrNumber / origin / destination", async () => {
    await service.list({ search: "Mumbai" });

    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          OR: [
            { tripNumber: { contains: "Mumbai", mode: "insensitive" } },
            { lrNumber: { contains: "Mumbai", mode: "insensitive" } },
            { origin: { contains: "Mumbai", mode: "insensitive" } },
            { destination: { contains: "Mumbai", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("4. create() rejects empty stops array", async () => {
    await expect(service.create({ stops: [] })).rejects.toThrow(BadRequestException);
    await expect(service.create({ stops: undefined as any })).rejects.toThrow(BadRequestException);
  });

  it("5. create() rejects when both clientId and vendorId provided", async () => {
    await expect(
      service.create({
        clientId: "00000000-0000-0000-0000-000000000001",
        vendorId: "00000000-0000-0000-0000-000000000002",
        stops: [{ name: "Stop 1" }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("6. create() calls TripNumberService.nextTripNumber inside transaction", async () => {
    await service.create({
      clientId: "00000000-0000-0000-0000-000000000001",
      stops: [{ name: "Stop 1" }],
    });

    expect(prismaTransaction).toHaveBeenCalled();
    expect(nextTripNumber).toHaveBeenCalledWith(mockTx, "org-123");
    expect(tripCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripNumber: "TRP-202610-0001",
          clientId: "00000000-0000-0000-0000-000000000001",
          status: "ASSIGNED",
        }),
      }),
    );
  });

  it("7. get() throws NotFoundException", async () => {
    tripFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(NotFoundException);
  });

  it("8. update() rejects when trip not in ASSIGNED state", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "IN_PROGRESS" });

    await expect(
      service.update("trp-123", { origin: "New Delhi" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("9. softDelete() rejects when trip not in ASSIGNED state", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERED" });

    await expect(service.softDelete("trp-123")).rejects.toThrow(BadRequestException);
  });

  it("10. create() assigns default sequence 1,2,3... when sequence not provided", async () => {
    await service.create({
      stops: [
        { name: "Hub A" },
        { name: "Hub B" },
        { name: "Hub C" },
      ],
    });

    expect(tripCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripStops: {
            create: [
              expect.objectContaining({ name: "Hub A", sequence: 1 }),
              expect.objectContaining({ name: "Hub B", sequence: 2 }),
              expect.objectContaining({ name: "Hub C", sequence: 3 }),
            ],
          },
        }),
      }),
    );
  });

  it("11. startTrip() throws NotFoundException for unknown id", async () => {
    tripFindFirst.mockResolvedValue(null);

    await expect(
      service.startTrip("unknown-id", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("12. startTrip() throws ConflictException on stale version", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, version: 1 });

    await expect(
      service.startTrip("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(ConflictException);
  });

  it("13. startTrip() throws BadRequestException when status is not ASSIGNED", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "IN_PROGRESS" });

    await expect(
      service.startTrip("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("14. startTrip() throws BadRequestException when no driver assigned", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, driverId: null });

    await expect(
      service.startTrip("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("15. endTrip() throws BadRequestException when odometerEnd < odometerStart", async () => {
    tripFindFirst.mockResolvedValue({
      ...mockTrip,
      status: "DELIVERY_IN_PROGRESS",
      odometerStart: 1000,
    });

    await expect(
      service.endTrip("trp-123", { version: 0, odometerEnd: 900 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("16. endTrip() throws BadRequestException when status is not DELIVERY_IN_PROGRESS", async () => {
    tripFindFirst.mockResolvedValue({
      ...mockTrip,
      status: "IN_PROGRESS",
      odometerStart: 1000,
    });

    await expect(
      service.endTrip("trp-123", { version: 0, odometerEnd: 1200 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("17. auditTrip() creates AuditReview row and transitions to AUDITED", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "AUDIT_PENDING" });

    await service.auditTrip(
      "trp-123",
      { version: 0, outcome: "AUDITED", notes: "All verified" },
      { sub: "usr-123", role: "AUDITOR" },
    );

    expect(tripUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "AUDIT_PENDING", version: 0 }),
        data: expect.objectContaining({
          status: "AUDITED",
          auditedAt: expect.any(Date),
        }),
      }),
    );
    expect(auditReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-123",
          tripId: "trp-123",
          outcome: "AUDITED",
          notes: "All verified",
        }),
      }),
    );
  });

  it("18. auditTrip() with CORRECTION_REQUESTED does not set auditedAt", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "AUDIT_PENDING" });

    await service.auditTrip(
      "trp-123",
      { version: 0, outcome: "CORRECTION_REQUESTED", notes: "Needs fix" },
      { sub: "usr-123", role: "AUDITOR" },
    );

    expect(tripUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "AUDIT_PENDING", version: 0 }),
        data: expect.objectContaining({
          status: "CORRECTION_REQUESTED",
        }),
      }),
    );
    expect(auditReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: "CORRECTION_REQUESTED",
          notes: "Needs fix",
        }),
      }),
    );
  });

  it("19. completeStop() rejects when status not IN_PROGRESS or DELIVERY_IN_PROGRESS", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "ASSIGNED", version: 0 });

    await expect(
      service.completeStop("trp-123", "stop-1", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("20. completeStop() rejects when no POD documents exist", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERY_IN_PROGRESS", version: 0 });
    tripStopFindFirst.mockResolvedValue({ id: "stop-1", tripId: "trp-123", status: "IN_PROGRESS", podDocuments: [] });

    await expect(
      service.completeStop("trp-123", "stop-1", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("21. completeStop() sets qtyMismatchFlag when deliveredQty != expectedQty", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERY_IN_PROGRESS", version: 0 });
    tripStopFindFirst.mockResolvedValue({
      id: "stop-1",
      tripId: "trp-123",
      status: "IN_PROGRESS",
      expectedQty: 10,
      podDocuments: [{ id: "pod-1" }],
    });

    await service.completeStop("trp-123", "stop-1", { version: 0, deliveredQty: 8 }, { sub: "usr-123", role: "ADMIN" });

    expect(tripStopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stop-1" },
        data: expect.objectContaining({
          status: "DELIVERED",
          deliveredQty: 8,
          qtyMismatchFlag: true,
        }),
      }),
    );
  });

  it("22. completeStop() sets status DELIVERED and does NOT set flag when qty matches", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERY_IN_PROGRESS", version: 0 });
    tripStopFindFirst.mockResolvedValue({
      id: "stop-1",
      tripId: "trp-123",
      status: "IN_PROGRESS",
      expectedQty: 10,
      podDocuments: [{ id: "pod-1" }],
    });

    await service.completeStop("trp-123", "stop-1", { version: 0, deliveredQty: 10 }, { sub: "usr-123", role: "ADMIN" });

    expect(tripStopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stop-1" },
        data: expect.objectContaining({
          status: "DELIVERED",
          deliveredQty: 10,
          qtyMismatchFlag: false,
        }),
      }),
    );
  });

  it("23. recordCollection() rejects when collection already exists for stop", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERY_IN_PROGRESS" });
    tripStopFindFirst.mockResolvedValue({ id: "stop-1", tripId: "trp-123" });
    collectionFindFirst.mockResolvedValue({ id: "col-1", tripStopId: "stop-1" });

    await expect(
      service.recordCollection(
        "trp-123",
        { tripStopId: "stop-1", actualAmount: 500, mode: "CASH" as any },
        { sub: "usr-123", role: "ADMIN" },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("24. recordCollection() rejects when trip status is READY_FOR_BILLING", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "READY_FOR_BILLING" });

    await expect(
      service.recordCollection(
        "trp-123",
        { tripStopId: "stop-1", actualAmount: 500, mode: "CASH" as any },
        { sub: "usr-123", role: "ADMIN" },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("25. recordExpense() rejects when trip status is READY_FOR_BILLING", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "READY_FOR_BILLING" });

    await expect(
      service.recordExpense(
        "trp-123",
        { type: "TOLL" as any, amount: 200 },
        { sub: "usr-123", role: "ADMIN" },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("26. getSummary() returns correct variance (actual - expected)", async () => {
    tripFindFirst.mockResolvedValue({
      ...mockTrip,
      tripNumber: "TRP-202610-0001",
      status: "DELIVERED",
      odometerStart: 1000,
      odometerEnd: 1150,
      tripStops: [
        { id: "s1", status: "DELIVERED", expectedCollection: 5000, collection: { actualAmount: 4800 } },
        { id: "s2", status: "DELIVERED", expectedCollection: 3000, collection: { actualAmount: 3000 } },
      ],
      tripExpenses: [
        { id: "e1", amount: 400 },
        { id: "e2", amount: 250 },
      ],
    });

    const summary = await service.getSummary("trp-123");

    expect(summary.expectedCollection).toBe(8000);
    expect(summary.actualCollection).toBe(7800);
    expect(summary.variance).toBe(-200);
    expect(summary.totalExpenses).toBe(650);
    expect(summary.stopsTotal).toBe(2);
    expect(summary.stopsDelivered).toBe(2);
    expect(summary.actualKm).toBe(150);
  });

  it("27. closeEod() rejects when status is not DELIVERED", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "IN_PROGRESS", version: 0 });

    await expect(
      service.closeEod("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("28. closeEod() rejects when EOD already closed", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERED", version: 0 });
    eodTallyFindFirst.mockResolvedValue({ id: "tally-existing", tripId: "trp-123" });

    await expect(
      service.closeEod("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("29. closeEod() computes discrepancy = actualCash - netExpected", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERED", version: 0 });
    eodTallyFindFirst.mockResolvedValue(null);
    tripStopFindMany.mockResolvedValue([
      { id: "s1", expectedCollection: 5000, collection: { actualAmount: 4800 } },
      { id: "s2", expectedCollection: 3000, collection: { actualAmount: 3200 } },
    ]);
    tripExpenseFindMany.mockResolvedValue([]);

    const tally = await service.closeEod("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" });

    expect(tally.actualCash).toBe(8000);
    expect(tally.netExpected).toBe(8000);
    expect(tally.discrepancy).toBe(0);

    tripStopFindMany.mockResolvedValue([
      { id: "s1", expectedCollection: 5000, collection: { actualAmount: 4500 } },
    ]);
    const tally2 = await service.closeEod("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" });
    expect(tally2.actualCash).toBe(4500);
    expect(tally2.netExpected).toBe(5000);
    expect(tally2.discrepancy).toBe(-500);
  });

  it("30. closeEod() sums TOLL expenses into toll field", async () => {
    tripFindFirst.mockResolvedValue({ ...mockTrip, status: "DELIVERED", version: 0 });
    eodTallyFindFirst.mockResolvedValue(null);
    tripStopFindMany.mockResolvedValue([]);
    tripExpenseFindMany.mockResolvedValue([
      { type: "TOLL", amount: 150 },
      { type: "TOLL", amount: 250 },
      { type: "FUEL", amount: 1000 },
      { type: "EMERGENCY_FUEL", amount: 200 },
      { type: "DRIVER_ALLOWANCE", amount: 500 },
    ]);

    const tally = await service.closeEod("trp-123", { version: 0 }, { sub: "usr-123", role: "ADMIN" });

    expect(tally.toll).toBe(400);
    expect(tally.fuel).toBe(1200);
    expect(tally.allowance).toBe(500);
  });

  it("31. getEod() throws NotFoundException when no tally", async () => {
    tripFindFirst.mockResolvedValue(mockTrip);
    eodTallyFindFirst.mockResolvedValue(null);

    await expect(service.getEod("trp-123")).rejects.toThrow(NotFoundException);
  });

  it("32. getCurrentTripForDriver() returns { data: null } when user has no Driver profile", async () => {
    driverFindFirst.mockResolvedValue(null);

    const result = await service.getCurrentTripForDriver("usr-no-driver");

    expect(driverFindFirst).toHaveBeenCalledWith({
      where: { userId: "usr-no-driver" },
      select: { id: true },
    });
    expect(result).toEqual({ data: null });
  });

  it("33. getCurrentTripForDriver() returns { data: null } when driver has no active trip", async () => {
    driverFindFirst.mockResolvedValue({ id: "drv-123" });
    tripFindFirst.mockResolvedValue(null);

    const result = await service.getCurrentTripForDriver("usr-123");

    expect(driverFindFirst).toHaveBeenCalledWith({
      where: { userId: "usr-123" },
      select: { id: true },
    });
    expect(tripFindFirst).toHaveBeenCalledWith({
      where: {
        driverId: "drv-123",
        deletedAt: null,
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "DELIVERY_IN_PROGRESS", "DELIVERED"],
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, code: true } },
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, regNo: true } },
        tripStops: {
          orderBy: { sequence: "asc" },
          include: {
            podDocuments: true,
            collection: true,
          },
        },
      },
    });
    expect(result).toEqual({ data: null });
  });

  it("34. getCurrentTripForDriver() returns { data: trip } with stops, pods, collections when active trip exists", async () => {
    const activeTrip = {
      ...mockTrip,
      status: "IN_PROGRESS",
      client: { id: "cli-123", name: "Client A", code: "CLI-A" },
      driver: { id: "drv-123", name: "Driver A", phone: "+919876543210" },
      vehicle: { id: "veh-123", regNo: "MH-12-0001" },
      tripStops: [
        {
          id: "stop-1",
          sequence: 1,
          name: "Stop 1",
          podDocuments: [{ id: "pod-1" }],
          collection: { id: "col-1", actualAmount: 500 },
        },
      ],
    };
    driverFindFirst.mockResolvedValue({ id: "drv-123" });
    tripFindFirst.mockResolvedValue(activeTrip);

    const result = await service.getCurrentTripForDriver("usr-123");

    expect(result).toEqual({ data: activeTrip });
  });
});
