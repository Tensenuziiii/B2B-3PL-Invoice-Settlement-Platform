import { BadRequestException } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { RateCardsService } from "../rate-cards/rate-cards.service";

describe("BillingService", () => {
  let service: BillingService;
  let mockRateCardsService: { resolve: jest.Mock };

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
    mockRateCardsService = {
      resolve: jest.fn(),
    };
    service = new BillingService(mockRateCardsService as unknown as RateCardsService);
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
});
