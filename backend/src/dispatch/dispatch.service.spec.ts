import { BadRequestException } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from './dispatch.service';

describe('DispatchService', () => {
  let service: DispatchService;
  let tripFindMany: jest.Mock;
  let tripCount: jest.Mock;
  let vehicleCount: jest.Mock;
  let lorryReceiptAggregate: jest.Mock;
  let driverAdvanceAggregate: jest.Mock;
  let hubFindFirst: jest.Mock;
  let systemAlertFindMany: jest.Mock;
  let notificationFindMany: jest.Mock;

  beforeEach(() => {
    tripFindMany = jest.fn();
    tripCount = jest.fn();
    vehicleCount = jest.fn();
    lorryReceiptAggregate = jest.fn();
    driverAdvanceAggregate = jest.fn();
    hubFindFirst = jest.fn();
    systemAlertFindMany = jest.fn();
    notificationFindMany = jest.fn();
    service = new DispatchService(
      {
        trip: { findMany: tripFindMany, count: tripCount },
        vehicle: { count: vehicleCount },
        lorryReceipt: { aggregate: lorryReceiptAggregate },
        driverAdvance: { aggregate: driverAdvanceAggregate },
        hub: { findFirst: hubFindFirst },
        systemAlert: { findMany: systemAlertFindMany },
        notification: { findMany: notificationFindMany },
      } as unknown as PrismaService,
    );
  });

  it('returns active alerts from the database using the established shape', async () => {
    systemAlertFindMany.mockResolvedValue([
      {
        id: 'alert-1',
        severity: 'HIGH',
        title: 'GPS sync failed',
        vehicle: 'HR 55 AH 7812',
        source: 'No telematics ping received.',
        dismissedAt: null,
      },
    ]);

    await expect(service.getAlerts()).resolves.toEqual({
      data: [
        {
          id: 'alert-1',
          severity: 'HIGH',
          title: 'GPS sync failed',
          vehicle: 'HR 55 AH 7812',
          message: 'No telematics ping received.',
          dismissed: false,
        },
      ],
    });
    expect(systemAlertFindMany).toHaveBeenCalledWith({
      where: { dismissedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('limits notifications to the signed-in user and global notices', async () => {
    notificationFindMany.mockResolvedValue([
      {
        id: 'notification-1',
        title: 'Trip delayed',
        body: 'TRIP-8843 missed ETA threshold',
        readAt: null,
      },
      {
        id: 'notification-2',
        title: 'EOD due',
        body: 'Audit queues are ready for review',
        readAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    ]);

    await expect(service.getNotifications('user-1')).resolves.toEqual({
      data: [
        {
          id: 'notification-1',
          title: 'Trip delayed',
          body: 'TRIP-8843 missed ETA threshold',
          read: false,
        },
        {
          id: 'notification-2',
          title: 'EOD due',
          body: 'Audit queues are ready for review',
          read: true,
        },
      ],
    });
    expect(notificationFindMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'user-1' }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('calculates overview KPIs from database counts and aggregates', async () => {
    tripCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    vehicleCount.mockResolvedValue(8);
    lorryReceiptAggregate.mockResolvedValue({
      _sum: { codAmount: 30000 },
      _count: { _all: 3 },
    });
    driverAdvanceAggregate.mockResolvedValue({ _sum: { amount: 4000 } });
    hubFindFirst.mockResolvedValue({ name: 'Western Corridor Hub' });

    const result = await service.getOverview();

    expect(result.header).toEqual({ active: 4, delayed: 1, totalFleet: 8 });
    expect(result.kpis).toEqual([
      {
        key: 'liveDispatched',
        label: 'Live Dispatched',
        value: '4',
        meta: '75% on schedule',
        icon: 'truck',
      },
      {
        key: 'expectedCodInbound',
        label: 'Expected COD Inbound',
        value: '₹30,000',
        meta: '3 trips',
        icon: 'banknote',
      },
      {
        key: 'dispatchedAdvances',
        label: 'Dispatched Advances',
        value: '₹4,000',
        meta: 'Fuel & toll float',
        icon: 'card',
      },
      {
        key: 'pendingEodAudit',
        label: 'Pending EOD Audit',
        value: '2 Vehicles',
        meta: 'Docked & Waiting',
        icon: 'clock',
      },
    ]);
    expect(result.fleetUtilization).toEqual({
      value: 50,
      deltaPct: 0,
      sparkline: [],
    });
    expect(result.hub).toMatchObject({
      name: 'Western Corridor Hub',
      shift: 'Shift 1',
    });
    expect(result.hub.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.sidebarBadges).toEqual({ eodReconciliation: 2 });
    expect(lorryReceiptAggregate).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        trip: {
          deletedAt: null,
          status: {
            in: [
              TripStatus.IN_TRANSIT,
              TripStatus.DELAYED,
              TripStatus.UNLOADING,
            ],
          },
        },
      },
      _sum: { codAmount: true },
      _count: { _all: true },
    });
  });

  it('returns safe zero values when the database has no dispatch data', async () => {
    tripCount.mockResolvedValue(0);
    vehicleCount.mockResolvedValue(0);
    lorryReceiptAggregate.mockResolvedValue({
      _sum: { codAmount: null },
      _count: { _all: 0 },
    });
    driverAdvanceAggregate.mockResolvedValue({ _sum: { amount: null } });
    hubFindFirst.mockResolvedValue(null);

    const result = await service.getOverview();

    expect(result.header).toEqual({ active: 0, delayed: 0, totalFleet: 0 });
    expect(result.kpis[0].meta).toBe('0% on schedule');
    expect(result.kpis[1].value).toBe('₹0');
    expect(result.kpis[2].value).toBe('₹0');
    expect(result.kpis[3].value).toBe('0 Vehicles');
    expect(result.fleetUtilization.value).toBe(0);
    expect(result.hub.name).toBe('No hub configured');
    expect(result.sidebarBadges.eodReconciliation).toBe(0);
  });

  it('queries and maps database fleet rows without changing the response shape', async () => {
    tripFindMany.mockResolvedValue([
      {
        tripCode: 'TRIP-1001',
        status: TripStatus.IN_TRANSIT,
        origin: 'Bhiwandi Hub, MH',
        destination: 'Sanand Industrial Park, GJ',
        startOdometer: 142380,
        currentOdometer: 142890,
        delayMinutes: 0,
        delayReason: null,
        eta: new Date('2026-10-03T18:30:00.000Z'),
        vehicle: { regNo: 'MH 12 RN 4920' },
        driver: { name: 'Rajesh Kumar', phone: '+91 98231 44021' },
      },
    ]);
    tripCount.mockResolvedValue(8);

    const result = await service.getFleet('IN_TRANSIT', 'Rajesh');

    expect(tripFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: TripStatus.IN_TRANSIT,
        OR: expect.arrayContaining([
          { tripCode: { contains: 'Rajesh', mode: 'insensitive' } },
          {
            driver: {
              is: { name: { contains: 'Rajesh', mode: 'insensitive' } },
            },
          },
        ]),
      },
      include: { vehicle: true, driver: true },
      orderBy: { tripCode: 'asc' },
    });
    expect(result).toEqual({
      data: [
        {
          regNo: 'MH 12 RN 4920',
          tripCode: 'TRIP-1001',
          driver: { name: 'Rajesh Kumar', phone: '+91 98231 44021' },
          destination: 'Sanand Industrial Park, GJ',
          originNote: 'From Bhiwandi Hub, MH • ETA 2026-10-03T18:30:00.000Z',
          startOdometer: 142380,
          currentOdometer: 142890,
          status: TripStatus.IN_TRANSIT,
        },
      ],
      meta: { showing: 1, total: 8 },
    });
  });

  it('rejects an unknown fleet status instead of querying an invalid enum', async () => {
    await expect(service.getFleet('FLYING')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tripFindMany).not.toHaveBeenCalled();
  });

  it('returns only trips awaiting EOD reconciliation', async () => {
    tripFindMany.mockResolvedValue([
      {
        tripCode: 'TRIP-2001',
        vehicle: { regNo: 'KA 01 AJ 3319' },
      },
    ]);

    await expect(service.getEodReconciliation()).resolves.toEqual({
      data: [
        {
          tripCode: 'TRIP-2001',
          regNo: 'KA 01 AJ 3319',
          status: 'PENDING_EOD',
        },
      ],
    });
    expect(tripFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: TripStatus.EOD_PENDING },
      include: { vehicle: true },
      orderBy: { updatedAt: 'asc' },
    });
  });
});