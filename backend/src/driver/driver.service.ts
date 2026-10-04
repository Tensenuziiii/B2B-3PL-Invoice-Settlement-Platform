import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriverService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignedTrips(userId: string) {
    const trips = await this.prisma.trip.findMany({
      where: {
        deletedAt: null,
        driver: { is: { userId, deletedAt: null } },
      },
      include: {
        vehicle: { select: { regNo: true } },
        client: { select: { name: true, code: true } },
        lorryReceipt: {
          select: {
            lrNo: true,
            consignee: true,
            pallets: true,
            weightKg: true,
            codAmount: true,
            goodsDescription: true,
          },
        },
        tripStops: {
          orderBy: { order: 'asc' },
          select: { order: true, name: true, address: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return {
      data: trips.map((trip) => ({
        tripCode: trip.tripCode,
        status: trip.status,
        origin: trip.origin ?? '',
        destination: trip.destination ?? '',
        eta: trip.eta,
        startOdometer: trip.startOdometer,
        currentOdometer: trip.currentOdometer,
        vehicleRegNo: trip.vehicle?.regNo ?? '',
        client: trip.client
          ? { name: trip.client.name, code: trip.client.code }
          : null,
        lorryReceipt: trip.lorryReceipt,
        stops: trip.tripStops,
      })),
    };
  }

  async markArrived(userId: string, tripCode: string, expectedVersion: number) {
    return this.prisma.$transaction(async (transaction) => {
      const trip = await transaction.trip.findFirst({
        where: {
          tripCode,
          deletedAt: null,
          driver: { is: { userId, deletedAt: null } },
        },
        select: { id: true, tripCode: true, status: true, version: true },
      });

      if (!trip) {
        throw new NotFoundException('Assigned trip not found.');
      }

      if (trip.version !== expectedVersion) {
        throw new ConflictException('Trip was updated. Refresh and try again.');
      }

      if (
        trip.status !== TripStatus.IN_TRANSIT &&
        trip.status !== TripStatus.DELAYED
      ) {
        throw new ConflictException('Trip cannot be marked arrived from its current status.');
      }

      const updated = await transaction.trip.updateMany({
        where: {
          id: trip.id,
          version: expectedVersion,
          status: trip.status,
        },
        data: {
          status: TripStatus.ARRIVED,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Trip was updated. Refresh and try again.');
      }

      await transaction.auditLog.create({
        data: {
          actorId: userId,
          actorRole: Role.DRIVER,
          action: 'TRIP_MARKED_ARRIVED',
          entity: 'Trip',
          entityId: trip.id,
          beforeJson: { status: trip.status, version: trip.version },
          afterJson: {
            status: TripStatus.ARRIVED,
            version: trip.version + 1,
          },
        },
      });

      return {
        tripCode: trip.tripCode,
        status: TripStatus.ARRIVED,
        version: trip.version + 1,
      };
    });
  }
}