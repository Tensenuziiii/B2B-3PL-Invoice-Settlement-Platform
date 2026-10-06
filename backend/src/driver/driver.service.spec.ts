import { ConflictException, NotFoundException } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DriverService } from './driver.service';

describe('DriverService', () => {
  let service: DriverService;
  let tripFindMany: jest.Mock;
  let tripFindFirst: jest.Mock;
  let tripUpdateMany: jest.Mock;
  let auditLogCreate: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    tripFindMany = jest.fn();
    tripFindFirst = jest.fn();
    tripUpdateMany = jest.fn();
    auditLogCreate = jest.fn();
    const transactionClient = {
      trip: { findFirst: tripFindFirst, updateMany: tripUpdateMany },
      auditLog: { create: auditLogCreate },
    };
    transaction = jest.fn(
      (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );
    service = new DriverService({
      trip: {
        findMany: tripFindMany,
        findFirst: tripFindFirst,
        updateMany: tripUpdateMany,
      },
      auditLog: { create: auditLogCreate },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('returns assigned trip data and filters ownership in the query', async () => {
    tripFindMany.mockResolvedValue([
      {
        tripNumber: 'TRIP-1001',
        status: 'IN_PROGRESS',
        origin: 'Bhiwandi Hub',
        destination: 'Whitefield RDC',
        eta: new Date('2026-10-03T18:30:00.000Z'),
        startOdometer: 142380,
        currentOdometer: 142890,
        vehicle: { regNo: 'MH 12 RN 4920' },
        client: { name: 'Metro Wholesale India', code: 'METRO-WHOLESALE' },
        tripStops: [{ sequence: 1, name: 'Whitefield RDC', address: 'EPIP Zone' }],
      },
    ]);

    await expect(service.getAssignedTrips('user-driver')).resolves.toEqual({
      data: [
        {
          tripNumber: 'TRIP-1001',
          status: 'IN_PROGRESS',
          origin: 'Bhiwandi Hub',
          destination: 'Whitefield RDC',
          eta: new Date('2026-10-03T18:30:00.000Z'),
          startOdometer: 142380,
          currentOdometer: 142890,
          vehicleRegNo: 'MH 12 RN 4920',
          client: { name: 'Metro Wholesale India', code: 'METRO-WHOLESALE' },
          stops: [{ sequence: 1, name: 'Whitefield RDC', address: 'EPIP Zone' }],
        },
      ],
    });
    expect(tripFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        driver: { is: { userId: 'user-driver', deletedAt: null } },
      },
      include: {
        vehicle: { select: { regNo: true } },
        client: { select: { name: true, code: true } },
        tripStops: {
          orderBy: { sequence: 'asc' },
          select: { sequence: true, name: true, address: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  });

  it('returns an empty list when the signed-in driver has no assignments', async () => {
    tripFindMany.mockResolvedValue([]);

    await expect(service.getAssignedTrips('user-driver')).resolves.toEqual({
      data: [],
    });
  });

  it('marks an owned in-transit trip arrived and audits the versioned transition', async () => {
    tripFindFirst.mockResolvedValue({
      id: 'trip-id',
      tripNumber: 'TRIP-1001',
      status: TripStatus.IN_PROGRESS,
      version: 3,
    });
    tripUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.markArrived('user-driver', 'TRIP-1001', 3),
    ).resolves.toEqual({
      tripNumber: 'TRIP-1001',
      status: TripStatus.DELIVERY_IN_PROGRESS,
      version: 4,
    });
    expect(tripFindFirst).toHaveBeenCalledWith({
      where: {
        tripNumber: 'TRIP-1001',
        deletedAt: null,
        driver: { is: { userId: 'user-driver', deletedAt: null } },
      },
      select: { id: true, tripNumber: true, status: true, version: true },
    });
    expect(tripUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'trip-id',
        version: 3,
        status: TripStatus.IN_PROGRESS,
      },
      data: { status: TripStatus.DELIVERY_IN_PROGRESS, version: { increment: 1 } },
    });
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'user-driver',
        actorRole: 'DRIVER',
        action: 'TRIP_MARKED_ARRIVED',
        entity: 'Trip',
        entityId: 'trip-id',
        beforeJson: { status: TripStatus.IN_PROGRESS, version: 3 },
        afterJson: { status: TripStatus.DELIVERY_IN_PROGRESS, version: 4 },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('hides trips that are not assigned to the signed-in driver', async () => {
    tripFindFirst.mockResolvedValue(null);

    await expect(
      service.markArrived('user-driver', 'TRIP-OTHER', 0),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tripUpdateMany).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it('rejects stale trip versions and invalid lifecycle states', async () => {
    tripFindFirst.mockResolvedValue({
      id: 'trip-id',
      tripNumber: 'TRIP-1001',
      status: TripStatus.IN_PROGRESS,
      version: 4,
    });

    await expect(
      service.markArrived('user-driver', 'TRIP-1001', 3),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tripUpdateMany).not.toHaveBeenCalled();

    tripFindFirst.mockResolvedValue({
      id: 'trip-id',
      tripNumber: 'TRIP-1001',
      status: TripStatus.DELIVERY_IN_PROGRESS,
      version: 3,
    });
    await expect(
      service.markArrived('user-driver', 'TRIP-1001', 3),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tripUpdateMany).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it('rejects a concurrent update instead of writing a stale audit record', async () => {
    tripFindFirst.mockResolvedValue({
      id: 'trip-id',
      tripNumber: 'TRIP-1001',
      status: TripStatus.IN_PROGRESS,
      version: 3,
    });
    tripUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.markArrived('user-driver', 'TRIP-1001', 3),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});