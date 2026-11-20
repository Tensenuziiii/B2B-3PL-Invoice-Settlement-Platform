import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalSummary() {
    const { organizationId } = requireTenant();
    const now = new Date();

    // ─── 1. Active or Delayed Trips ──────────────────────────────────────────
    const activeStatuses = [
      "PLACED",
      "LOADING",
      "LOADED",
      "IN_TRANSIT",
      "UNLOADING",
      "ASSIGNED",
      "IN_PROGRESS",
      "DELIVERY_IN_PROGRESS",
    ];

    const activeTripsRaw = await this.prisma.trip.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: activeStatuses as any },
      },
      include: {
        vehicle: { select: { regNo: true } },
        driver: { select: { name: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeTrips = activeTripsRaw.map((t) => {
      const isDelayed = (t.delayMinutes ?? 0) > 0 || (t.eta ? new Date(t.eta) < now : false);
      return {
        id: t.id,
        tripNumber: t.tripNumber,
        status: t.status,
        origin: t.origin,
        destination: t.destination,
        eta: t.eta,
        delayMinutes: t.delayMinutes ?? 0,
        isDelayed,
        vehicleRegNo: t.vehicle?.regNo,
        driverName: t.driver?.name,
        clientName: t.client?.name,
      };
    });

    const delayedTripsCount = activeTrips.filter((t) => t.isDelayed).length;

    // ─── 2. PODs Pending or Overdue ─────────────────────────────────────────
    const pendingPodsRaw = await this.prisma.pod.findMany({
      where: {
        organizationId,
        currentStatus: { in: ["PENDING_DELIVERY", "SOFT_COPY_RECEIVED"] as any },
      },
      include: {
        trip: {
          select: {
            tripNumber: true,
            deliveredAt: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const pendingPods = pendingPodsRaw.map((p) => {
      const refDate = p.deliveredAt ?? p.trip?.deliveredAt ?? p.createdAt;
      const agingHours = Math.max(0, Math.round((now.getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60)));
      const isOverdue = agingHours > 24; // SLA standard 24h
      return {
        id: p.id,
        tripId: p.tripId,
        tripNumber: p.trip?.tripNumber ?? "N/A",
        currentStatus: p.currentStatus,
        deliveredAt: p.deliveredAt ?? p.trip?.deliveredAt,
        clientName: p.trip?.client?.name,
        agingHours,
        isOverdue,
      };
    });

    const overduePodsCount = pendingPods.filter((p) => p.isOverdue).length;

    // ─── 3. PODs On Hold (and Why) ──────────────────────────────────────────
    const podsOnHoldRaw = await this.prisma.pod.findMany({
      where: {
        organizationId,
        currentStatus: "ON_HOLD",
      },
      include: {
        trip: {
          select: {
            tripNumber: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const podsOnHold = podsOnHoldRaw.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      tripNumber: p.trip?.tripNumber ?? "N/A",
      holdReason: p.holdReason,
      holdRemarks: p.holdRemarks,
      updatedAt: p.updatedAt,
      clientName: p.trip?.client?.name,
    }));

    // ─── 4. Original PODs Expected, In-Transit, or Lost ──────────────────────
    const originalPodsRaw = await this.prisma.pod.findMany({
      where: {
        organizationId,
        currentStatus: { in: ["ORIGINAL_DISPATCHED", "LOST", "DUPLICATE_REQUESTED"] as any },
      },
      include: {
        trip: {
          select: {
            tripNumber: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const inTransitOriginals = originalPodsRaw.filter((p) => p.currentStatus === "ORIGINAL_DISPATCHED");
    const lostOriginals = originalPodsRaw.filter((p) => p.currentStatus === "LOST");
    const duplicateRequested = originalPodsRaw.filter((p) => p.currentStatus === "DUPLICATE_REQUESTED");

    const originalPods = originalPodsRaw.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      tripNumber: p.trip?.tripNumber ?? "N/A",
      currentStatus: p.currentStatus,
      courierName: p.courierName,
      courierTrackingNo: p.courierTrackingNo,
      courierDispatchedAt: p.courierDispatchedAt,
      clientName: p.trip?.client?.name,
    }));

    // ─── 5. Invoices Needing Follow-Up or Overdue ───────────────────────────
    const actionableInvoiceStatuses = [
      "DRAFT",
      "SUBMITTED",
      "IN_STAGE",
      "APPROVED_STAGE",
      "ON_HOLD",
      "CLIENT_REVIEW",
      "OVERDUE",
    ];

    const invoicesRaw = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: actionableInvoiceStatuses as any },
      },
      include: {
        client: { select: { name: true } },
        followUps: {
          orderBy: { contactedOn: "desc" },
          take: 1,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const followUpInvoices = invoicesRaw.map((inv) => {
      const isOverdue = inv.dueDate ? new Date(inv.dueDate) < now : false;
      const latestFollowUp = inv.followUps?.[0];
      const needsFollowUp =
        isOverdue ||
        (latestFollowUp?.nextFollowUpOn ? new Date(latestFollowUp.nextFollowUpOn) <= now : true);

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        dueDate: inv.dueDate,
        totalPaise: inv.total,
        clientName: inv.client?.name,
        isOverdue,
        needsFollowUp,
        lastContactedOn: latestFollowUp?.contactedOn ?? null,
        nextFollowUpOn: latestFollowUp?.nextFollowUpOn ?? null,
        lastOutcome: latestFollowUp?.outcome ?? null,
      };
    });

    const overdueInvoicesCount = followUpInvoices.filter((i) => i.isOverdue).length;

    return {
      activeTrips: {
        count: activeTrips.length,
        delayedCount: delayedTripsCount,
        trips: activeTrips,
      },
      pendingPods: {
        count: pendingPods.length,
        overdueCount: overduePodsCount,
        pods: pendingPods,
      },
      podsOnHold: {
        count: podsOnHold.length,
        pods: podsOnHold,
      },
      originalPods: {
        inTransitCount: inTransitOriginals.length,
        lostCount: lostOriginals.length,
        duplicateRequestedCount: duplicateRequested.length,
        pods: originalPods,
      },
      invoicesNeedingFollowUp: {
        count: followUpInvoices.length,
        overdueCount: overdueInvoicesCount,
        invoices: followUpInvoices,
      },
    };
  }
}
