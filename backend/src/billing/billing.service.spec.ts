import { BadRequestException } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { RateCardsService } from "../rate-cards/rate-cards.service";
import { PrismaService } from "../prisma/prisma.service";
import { InvoiceNumberService } from "./invoice-number.service";
import { tenantStorage } from "../core/tenant/tenant.context";
import { GenerateInvoiceDto } from "./dto/generate-invoice.dto";

describe("BillingService", () => {
  let service: BillingService;
  let mockRateCardsService: { resolve: jest.Mock };
  let mockPrismaService: any;
  let mockInvoiceNumbersService: { nextInvoiceNumber: jest.Mock };
  let mockTx: any;

  const createMockTrip = (overrides?: Record<string, any>): any => ({
    id: "trip-123",
    organizationId: "org-123",
    tripNumber: "TRP-202610-0001",
    status: "READY_FOR_BILLING",
    version: 1,
    clientId: "c1",
    vendorId: null,
    routeId: null,
    driverId: "drv-123",
    vehicleId: "veh-123",
    origin: "Origin",
    destination: "Dest",
    lrNumber: "LR-1001",
    eta: new Date("2026-10-10T12:00:00.000Z"),
    odometerStart: 100,
    odometerEnd: 600,
    delayMinutes: 0,
    delayReason: null,
    assignedAt: null,
    startedAt: null,
    deliveredAt: null,
    closedAt: null,
    auditRequestedAt: null,
    auditedAt: null,
    readyForBillingAt: new Date("2026-10-10T11:00:00.000Z"),
    createdAt: new Date("2026-10-10T08:00:00.000Z"),
    updatedAt: new Date("2026-10-10T11:00:00.000Z"),
    deletedAt: null,
    tripStops: [
      {
        id: "stop-1",
        tripId: "trip-123",
        sequence: 1,
        locationName: "Hub 1",
        address: "Address 1",
        lat: null,
        lng: null,
        status: "DELIVERED",
        expectedCollection: 0,
        deliveredAt: new Date("2026-10-10T09:00:00.000Z"),
        failureReason: null,
        notes: null,
        createdAt: new Date("2026-10-10T08:00:00.000Z"),
        updatedAt: new Date("2026-10-10T09:00:00.000Z"),
      },
      {
        id: "stop-2",
        tripId: "trip-123",
        sequence: 2,
        locationName: "Hub 2",
        address: "Address 2",
        lat: null,
        lng: null,
        status: "DELIVERED",
        expectedCollection: 0,
        deliveredAt: new Date("2026-10-10T10:00:00.000Z"),
        failureReason: null,
        notes: null,
        createdAt: new Date("2026-10-10T08:00:00.000Z"),
        updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    tenantStorage.enterWith({ organizationId: "org-123", userId: "usr-123" });

    mockRateCardsService = {
      resolve: jest.fn(),
    };
    mockTx = {
      trip: {
        findMany: jest.fn(),
      },
      invoiceLine: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      invoice: {
        create: jest.fn().mockImplementation((args) => ({
          id: "inv-123",
          invoiceNumber: args.data.invoiceNumber,
          status: args.data.status,
          total: args.data.total,
        })),
      },
      counter: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    mockPrismaService = {
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };
    mockInvoiceNumbersService = {
      nextInvoiceNumber: jest.fn().mockResolvedValue("INV-202610-0001"),
    };
    service = new BillingService(
      mockRateCardsService as unknown as RateCardsService,
      mockPrismaService as unknown as PrismaService,
      mockInvoiceNumbersService as unknown as InvoiceNumberService,
    );
  });

  afterEach(() => {
    tenantStorage.disable();
  });

  it("1. calculateTripCharge() throws when trip has no clientId", async () => {
    const trip = createMockTrip({ clientId: null });
    await expect(
      service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z")),
    ).rejects.toThrow(BadRequestException);
  });

  it("2. calculateTripCharge() throws when odometerStart or odometerEnd is null", async () => {
    const tripNoStart = createMockTrip({ odometerStart: null });
    await expect(
      service.calculateTripCharge(tripNoStart, new Date("2026-10-10T10:00:00.000Z")),
    ).rejects.toThrow(BadRequestException);

    const tripNoEnd = createMockTrip({ odometerEnd: null });
    await expect(
      service.calculateTripCharge(tripNoEnd, new Date("2026-10-10T10:00:00.000Z")),
    ).rejects.toThrow(BadRequestException);
  });

  it("3. calculateTripCharge() throws when odometerEnd < odometerStart", async () => {
    const trip = createMockTrip({ odometerStart: 500, odometerEnd: 200 });
    await expect(
      service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z")),
    ).rejects.toThrow(BadRequestException);
  });

  it("4. calculateTripCharge() prefers FIXED_TRIP over PER_DELIVERY and PER_KM (resolve called with FIXED_TRIP first)", async () => {
    const trip = createMockTrip();
    const onDate = new Date("2026-10-10T10:00:00.000Z");

    mockRateCardsService.resolve.mockResolvedValueOnce({
      rateCardId: "rc-1",
      rateCardName: "Fixed Trip Card",
      rateCardItemId: "rci-1",
      rateType: "FIXED_TRIP",
      rate: 150000,
      score: 1,
    });

    const res = await service.calculateTripCharge(trip, onDate);

    expect(mockRateCardsService.resolve).toHaveBeenCalledTimes(1);
    expect(mockRateCardsService.resolve).toHaveBeenCalledWith({
      counterpartyType: "CLIENT",
      counterpartyId: "c1",
      rateType: "FIXED_TRIP",
      onDate: onDate.toISOString(),
      routeId: undefined,
    });
    expect(res.snapshot.rateType).toBe("FIXED_TRIP");
  });

  it("5. calculateTripCharge() with FIXED_TRIP returns lineAmount = rate, quantity = 1", async () => {
    const trip = createMockTrip();
    mockRateCardsService.resolve.mockResolvedValueOnce({
      rateCardId: "rc-1",
      rateCardName: "Fixed Trip Card",
      rateCardItemId: "rci-1",
      rateType: "FIXED_TRIP",
      rate: 200000,
      score: 1,
    });

    const res = await service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z"));

    expect(res.lineAmountPaise).toBe(200000);
    expect(res.snapshot.quantity).toBe(1);
    expect(res.snapshot.quantityUnit).toBe("trip");
    expect(res.snapshot.subtotalPaise).toBe(200000);
  });

  it("6. calculateTripCharge() with PER_DELIVERY returns lineAmount = deliveredStopsCount × rate", async () => {
    const trip = createMockTrip({
      tripStops: [
        { id: "s1", status: "DELIVERED" },
        { id: "s2", status: "DELIVERED" },
        { id: "s3", status: "FAILED" },
      ],
    });

    mockRateCardsService.resolve
      .mockRejectedValueOnce(new Error("No FIXED_TRIP card"))
      .mockResolvedValueOnce({
        rateCardId: "rc-2",
        rateCardName: "Per Delivery Card",
        rateCardItemId: "rci-2",
        rateType: "PER_DELIVERY",
        rate: 50000,
        score: 1,
      });

    const res = await service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z"));

    expect(res.lineAmountPaise).toBe(2 * 50000);
    expect(res.snapshot.quantity).toBe(2);
    expect(res.snapshot.quantityUnit).toBe("delivery");
    expect(res.snapshot.deliveredStopsCount).toBe(2);
    expect(res.snapshot.billingDistanceKm).toBeNull();
  });

  it("7. calculateTripCharge() with PER_KM returns lineAmount = (end - start) × rate", async () => {
    const trip = createMockTrip({ odometerStart: 100, odometerEnd: 350 });

    mockRateCardsService.resolve
      .mockRejectedValueOnce(new Error("No FIXED_TRIP card"))
      .mockRejectedValueOnce(new Error("No PER_DELIVERY card"))
      .mockResolvedValueOnce({
        rateCardId: "rc-3",
        rateCardName: "Per KM Card",
        rateCardItemId: "rci-3",
        rateType: "PER_KM",
        rate: 2000,
        score: 1,
      });

    const res = await service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z"));

    expect(res.lineAmountPaise).toBe(250 * 2000);
    expect(res.snapshot.quantity).toBe(250);
    expect(res.snapshot.quantityUnit).toBe("km");
    expect(res.snapshot.billingDistanceKm).toBe(250);
    expect(res.snapshot.deliveredStopsCount).toBeNull();
  });

  it("8. calculateTripCharge() computes gstAmount = round(lineAmount × 0.18)", async () => {
    const trip = createMockTrip();
    mockRateCardsService.resolve.mockResolvedValueOnce({
      rateCardId: "rc-1",
      rateCardName: "Fixed Trip Card",
      rateCardItemId: "rci-1",
      rateType: "FIXED_TRIP",
      rate: 10555,
      score: 1,
    });

    const res = await service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z"));

    expect(res.lineAmountPaise).toBe(10555);
    expect(res.gstAmountPaise).toBe(Math.round(10555 * 0.18));
    expect(res.totalAmountPaise).toBe(10555 + Math.round(10555 * 0.18));
    expect(res.snapshot.gstRatePercent).toBe(18);
  });

  it("9. calculateTripCharge() throws when no rate type resolves (all 3 fail)", async () => {
    const trip = createMockTrip();
    mockRateCardsService.resolve
      .mockRejectedValueOnce(new Error("No FIXED_TRIP"))
      .mockRejectedValueOnce(new Error("No PER_DELIVERY"))
      .mockRejectedValueOnce(new Error("No PER_KM"));

    await expect(
      service.calculateTripCharge(trip, new Date("2026-10-10T10:00:00.000Z")),
    ).rejects.toThrow(BadRequestException);

    expect(mockRateCardsService.resolve).toHaveBeenCalledTimes(3);
  });

  it("10. Snapshot contains all required fields (rateCardItemId, rateType, quantity, resolvedAt, serviceDate)", async () => {
    const trip = createMockTrip();
    const onDate = new Date("2026-10-10T10:00:00.000Z");

    mockRateCardsService.resolve.mockResolvedValueOnce({
      rateCardId: "rc-1",
      rateCardName: "Fixed Trip Card",
      rateCardItemId: "rci-100",
      rateType: "FIXED_TRIP",
      rate: 50000,
      score: 1,
    });

    const res = await service.calculateTripCharge(trip, onDate);
    const { snapshot } = res;

    expect(snapshot.rateCardId).toBe("rc-1");
    expect(snapshot.rateCardName).toBe("Fixed Trip Card");
    expect(snapshot.rateCardItemId).toBe("rci-100");
    expect(snapshot.rateType).toBe("FIXED_TRIP");
    expect(snapshot.rateAmountPaise).toBe(50000);
    expect(snapshot.quantity).toBe(1);
    expect(snapshot.quantityUnit).toBe("trip");
    expect(snapshot.subtotalPaise).toBe(50000);
    expect(snapshot.gstAmountPaise).toBe(9000);
    expect(snapshot.totalAmountPaise).toBe(59000);
    expect(snapshot.resolvedAt).toBeDefined();
    expect(typeof snapshot.resolvedAt).toBe("string");
    expect(snapshot.serviceDate).toBe(onDate.toISOString());
  });

  it("11. generateInvoice() throws when tripIds has duplicates", async () => {
    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1", "trip-1"],
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-10T23:59:59.000Z",
    };
    await expect(service.generateInvoice(dto, "usr-123")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("12. generateInvoice() throws when periodEnd < periodStart", async () => {
    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1"],
      periodStart: "2026-10-10T00:00:00.000Z",
      periodEnd: "2026-10-01T00:00:00.000Z",
    };
    await expect(service.generateInvoice(dto, "usr-123")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("13. generateInvoice() throws when a trip is not found", async () => {
    mockTx.trip.findMany.mockResolvedValueOnce([
      createMockTrip({ id: "trip-1", clientId: "cli-123", status: "READY_FOR_BILLING" }),
    ]);

    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1", "trip-2"],
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-10T23:59:59.000Z",
    };

    await expect(service.generateInvoice(dto, "usr-123")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("14. generateInvoice() throws when a trip is not READY_FOR_BILLING", async () => {
    mockTx.trip.findMany.mockResolvedValueOnce([
      createMockTrip({ id: "trip-1", clientId: "cli-123", status: "DELIVERED" }),
    ]);

    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1"],
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-10T23:59:59.000Z",
    };

    await expect(service.generateInvoice(dto, "usr-123")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("15. generateInvoice() throws when a trip belongs to a different client", async () => {
    mockTx.trip.findMany.mockResolvedValueOnce([
      createMockTrip({ id: "trip-1", clientId: "cli-other", status: "READY_FOR_BILLING" }),
    ]);

    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1"],
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-10T23:59:59.000Z",
    };

    await expect(service.generateInvoice(dto, "usr-123")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("16. generateInvoice() creates invoice + line items with correct totals", async () => {
    const trip1 = createMockTrip({
      id: "trip-1",
      tripNumber: "TRP-202610-0001",
      clientId: "cli-123",
      status: "READY_FOR_BILLING",
      odometerStart: 100,
      odometerEnd: 600,
    });
    const trip2 = createMockTrip({
      id: "trip-2",
      tripNumber: "TRP-202610-0002",
      clientId: "cli-123",
      status: "READY_FOR_BILLING",
      odometerStart: 200,
      odometerEnd: 700,
    });

    mockTx.trip.findMany.mockResolvedValueOnce([trip1, trip2]);
    mockTx.invoiceLine.findMany.mockResolvedValueOnce([]);

    // For trip 1: 100,000 paise (FIXED_TRIP)
    // For trip 2: 150,000 paise (FIXED_TRIP)
    mockRateCardsService.resolve
      .mockResolvedValueOnce({
        rateCardId: "rc-1",
        rateCardName: "Fixed 1",
        rateCardItemId: "rci-1",
        rateType: "FIXED_TRIP",
        rate: 100000,
        score: 1,
      })
      .mockResolvedValueOnce({
        rateCardId: "rc-2",
        rateCardName: "Fixed 2",
        rateCardItemId: "rci-2",
        rateType: "FIXED_TRIP",
        rate: 150000,
        score: 1,
      });

    mockInvoiceNumbersService.nextInvoiceNumber.mockResolvedValueOnce("INV-202610-0001");

    const dto: GenerateInvoiceDto = {
      clientId: "cli-123",
      tripIds: ["trip-1", "trip-2"],
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-10T23:59:59.000Z",
      issueDate: "2026-10-10T10:00:00.000Z",
    };

    const result = await service.generateInvoice(dto, "usr-123");

    expect(mockTx.invoice.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-123",
        invoiceNumber: "INV-202610-0001",
        status: "DRAFT",
        clientId: "cli-123",
        issueDate: new Date("2026-10-10T10:00:00.000Z"),
        dueDate: null,
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2026-10-10T23:59:59.000Z"),
        subtotal: 250000,
        gstRate: 18,
        gstAmount: 45000,
        total: 295000,
      },
    });

    expect(mockTx.invoiceLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-123",
          invoiceId: "inv-123",
          tripId: "trip-1",
          lineAmount: 100000,
          gstAmount: 18000,
          totalAmount: 118000,
          snapshot: expect.objectContaining({
            rateCardItemId: "rci-1",
            rateType: "FIXED_TRIP",
            rateAmountPaise: 100000,
            quantity: 1,
          }),
        },
        {
          organizationId: "org-123",
          invoiceId: "inv-123",
          tripId: "trip-2",
          lineAmount: 150000,
          gstAmount: 27000,
          totalAmount: 177000,
          snapshot: expect.objectContaining({
            rateCardItemId: "rci-2",
            rateType: "FIXED_TRIP",
            rateAmountPaise: 150000,
            quantity: 1,
          }),
        },
      ],
    });

    expect(result).toEqual({
      id: "inv-123",
      invoiceNumber: "INV-202610-0001",
      status: "DRAFT",
      totalPaise: 295000,
    });
  });
});
