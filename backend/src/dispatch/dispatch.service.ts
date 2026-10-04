import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_TRIP_STATUSES = [
  TripStatus.IN_TRANSIT,
  TripStatus.DELAYED,
  TripStatus.UNLOADING,
];

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const activeTripsWhere: Prisma.TripWhereInput = {
      deletedAt: null,
      status: { in: ACTIVE_TRIP_STATUSES },
    };
    const [active, delayed, totalFleet, pendingEod, cod, advances, hub] =
      await Promise.all([
        this.prisma.trip.count({ where: activeTripsWhere }),
        this.prisma.trip.count({
          where: { deletedAt: null, status: TripStatus.DELAYED },
        }),
        this.prisma.vehicle.count({ where: { active: true, deletedAt: null } }),
        this.prisma.trip.count({
          where: { deletedAt: null, status: TripStatus.EOD_PENDING },
        }),
        this.prisma.lorryReceipt.aggregate({
          where: { deletedAt: null, trip: activeTripsWhere },
          _sum: { codAmount: true },
          _count: { _all: true },
        }),
        this.prisma.driverAdvance.aggregate({
          where: { trip: activeTripsWhere },
          _sum: { amount: true },
        }),
        this.prisma.hub.findFirst({
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        }),
      ]);
    const onSchedule = Math.max(active - delayed, 0);
    const onSchedulePercent = active
      ? Math.round((onSchedule / active) * 100)
      : 0;

    return {
      header: {
        active,
        delayed,
        totalFleet,
      },
      kpis: [
        {
          key: 'liveDispatched',
          label: 'Live Dispatched',
          value: String(active),
          meta: `${onSchedulePercent}% on schedule`,
          icon: 'truck',
        },
        {
          key: 'expectedCodInbound',
          label: 'Expected COD Inbound',
          value: this.formatCurrency(cod._sum.codAmount ?? 0),
          meta: `${cod._count._all} trips`,
          icon: 'banknote',
        },
        {
          key: 'dispatchedAdvances',
          label: 'Dispatched Advances',
          value: this.formatCurrency(advances._sum.amount ?? 0),
          meta: 'Fuel & toll float',
          icon: 'card',
        },
        {
          key: 'pendingEodAudit',
          label: 'Pending EOD Audit',
          value: `${pendingEod} Vehicles`,
          meta: 'Docked & Waiting',
          icon: 'clock',
        },
      ],
      fleetUtilization: {
        value: totalFleet ? Math.round((active / totalFleet) * 100) : 0,
        deltaPct: 0,
        sparkline: [],
      },
      hub: {
        name: hub?.name ?? 'No hub configured',
        shift: 'Shift 1',
        date: new Date().toISOString().slice(0, 10),
      },
      sidebarBadges: {
        eodReconciliation: pendingEod,
      },
    };
  }

  async getFleet(status = 'ALL', search = '') {
    const where: Prisma.TripWhereInput = { deletedAt: null };
    if (status !== 'ALL') {
      if (!Object.values(TripStatus).includes(status as TripStatus)) {
        throw new BadRequestException('Unsupported fleet status filter.');
      }
      where.status = status as TripStatus;
    }

    const normalizedSearch = search.trim();
    if (normalizedSearch) {
      where.OR = [
        { tripCode: { contains: normalizedSearch, mode: 'insensitive' } },
        { origin: { contains: normalizedSearch, mode: 'insensitive' } },
        { destination: { contains: normalizedSearch, mode: 'insensitive' } },
        {
          vehicle: {
            is: { regNo: { contains: normalizedSearch, mode: 'insensitive' } },
          },
        },
        {
          driver: {
            is: { name: { contains: normalizedSearch, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: { vehicle: true, driver: true },
        orderBy: { tripCode: 'asc' },
      }),
      this.prisma.trip.count({ where: { deletedAt: null } }),
    ]);
    const filtered = trips.map((trip) => ({
      regNo: trip.vehicle?.regNo ?? '',
      tripCode: trip.tripCode,
      driver: {
        name: trip.driver?.name ?? 'Unassigned',
        phone: trip.driver?.phone ?? '',
      },
      destination: trip.destination ?? '',
      originNote: this.formatOriginNote(trip),
      startOdometer: trip.startOdometer ?? 0,
      currentOdometer: trip.currentOdometer ?? trip.startOdometer ?? 0,
      status: trip.status,
    }));

    return {
      data: filtered,
      meta: {
        showing: filtered.length,
        total,
      },
    };
  }

  async getEodReconciliation() {
    const trips = await this.prisma.trip.findMany({
      where: { deletedAt: null, status: TripStatus.EOD_PENDING },
      include: { vehicle: true },
      orderBy: { updatedAt: 'asc' },
    });

    return {
      data: trips.map((trip) => ({
        tripCode: trip.tripCode,
        regNo: trip.vehicle?.regNo ?? '',
        status: 'PENDING_EOD',
      })),
    };
  }

  async getAlerts() {
    const alerts = await this.prisma.systemAlert.findMany({
      where: { dismissedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      data: alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        vehicle: alert.vehicle ?? '',
        message: alert.source ?? '',
        dismissed: alert.dismissedAt !== null,
      })),
    };
  }

  async getNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      data: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        read: notification.readAt !== null,
      })),
    };
  }

  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatOriginNote(trip: {
    origin: string | null;
    eta: Date | null;
    delayMinutes: number;
    delayReason: string | null;
  }) {
    const parts = [`From ${trip.origin ?? 'Origin unavailable'}`];
    if (trip.delayMinutes > 0) {
      parts.push(
        `Delayed ${trip.delayMinutes}m${trip.delayReason ? ` ${trip.delayReason}` : ''}`,
      );
    } else if (trip.eta) {
      parts.push(`ETA ${trip.eta.toISOString()}`);
    }
    return parts.join(' • ');
  }
}
