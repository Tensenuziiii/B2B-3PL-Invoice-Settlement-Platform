import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../prisma/prisma.service";
import * as tenantContext from "../core/tenant/tenant.context";

describe("DashboardService", () => {
  let service: DashboardService;
  let mockTripFindMany: jest.Mock;
  let mockPodFindMany: jest.Mock;
  let mockInvoiceFindMany: jest.Mock;

  beforeEach(() => {
    jest.spyOn(tenantContext, "requireTenant").mockReturnValue({
      organizationId: "org-123",
      userId: "usr-123",
    });

    mockTripFindMany = jest.fn().mockResolvedValue([
      {
        id: "trip-1",
        tripNumber: "TRP-001",
        status: "IN_TRANSIT",
        origin: "Mumbai",
        destination: "Pune",
        eta: new Date("2026-10-10T10:00:00Z"),
        delayMinutes: 30,
        vehicle: { regNo: "MH12AB1234" },
        driver: { name: "Ramesh Kumar" },
        client: { name: "Acme Logistics" },
      },
    ]);

    mockPodFindMany = jest.fn().mockImplementation((args: any) => {
      if (args.where?.currentStatus === "ON_HOLD") {
        return Promise.resolve([
          {
            id: "pod-hold-1",
            tripId: "trip-1",
            currentStatus: "ON_HOLD",
            holdReason: "LR Missing Stamp",
            holdRemarks: "Receiver did not stamp page 2",
            updatedAt: new Date("2026-10-11T12:00:00Z"),
            trip: {
              tripNumber: "TRP-001",
              client: { name: "Acme Logistics" },
            },
          },
        ]);
      }
      if (args.where?.currentStatus?.in?.includes("PENDING_DELIVERY")) {
        return Promise.resolve([
          {
            id: "pod-pending-1",
            tripId: "trip-2",
            currentStatus: "PENDING_DELIVERY",
            deliveredAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago (overdue)
            createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
            trip: {
              tripNumber: "TRP-002",
              deliveredAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
              client: { name: "Beta Corp" },
            },
          },
        ]);
      }
      if (args.where?.currentStatus?.in?.includes("ORIGINAL_DISPATCHED")) {
        return Promise.resolve([
          {
            id: "pod-orig-1",
            tripId: "trip-3",
            currentStatus: "ORIGINAL_DISPATCHED",
            courierName: "BlueDart",
            courierTrackingNo: "BD-9988",
            courierDispatchedAt: new Date("2026-10-12T09:00:00Z"),
            trip: {
              tripNumber: "TRP-003",
              client: { name: "Gamma Ltd" },
            },
          },
          {
            id: "pod-lost-1",
            tripId: "trip-4",
            currentStatus: "LOST",
            courierName: "SpeedPost",
            courierTrackingNo: null,
            courierDispatchedAt: null,
            trip: {
              tripNumber: "TRP-004",
              client: { name: "Delta Inc" },
            },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    mockInvoiceFindMany = jest.fn().mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV-202610-0001",
        status: "IN_STAGE",
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Overdue
        total: 118000,
        client: { name: "Acme Logistics" },
        followUps: [
          {
            contactedOn: new Date("2026-10-10"),
            nextFollowUpOn: new Date("2026-10-15"),
            outcome: "PROMISE_TO_PAY",
          },
        ],
      },
    ]);

    const mockPrisma = {
      trip: { findMany: mockTripFindMany },
      pod: { findMany: mockPodFindMany },
      invoice: { findMany: mockInvoiceFindMany },
    } as unknown as PrismaService;

    service = new DashboardService(mockPrisma);
  });

  it("1. getOperationalSummary() answers the 5 core R1 operational questions with live aggregations", async () => {
    const summary = await service.getOperationalSummary();

    // 1. Active or delayed trips
    expect(summary.activeTrips.count).toBe(1);
    expect(summary.activeTrips.delayedCount).toBe(1);
    expect(summary.activeTrips.trips[0].tripNumber).toBe("TRP-001");

    // 2. PODs pending or overdue
    expect(summary.pendingPods.count).toBe(1);
    expect(summary.pendingPods.overdueCount).toBe(1);
    expect(summary.pendingPods.pods[0].isOverdue).toBe(true);

    // 3. PODs on hold (and why)
    expect(summary.podsOnHold.count).toBe(1);
    expect(summary.podsOnHold.pods[0].holdReason).toBe("LR Missing Stamp");

    // 4. Original PODs in-transit, lost, duplicate
    expect(summary.originalPods.inTransitCount).toBe(1);
    expect(summary.originalPods.lostCount).toBe(1);
    expect(summary.originalPods.pods).toHaveLength(2);

    // 5. Invoices needing follow-up or overdue
    expect(summary.invoicesNeedingFollowUp.count).toBe(1);
    expect(summary.invoicesNeedingFollowUp.overdueCount).toBe(1);
    expect(summary.invoicesNeedingFollowUp.invoices[0].isOverdue).toBe(true);
  });
});
