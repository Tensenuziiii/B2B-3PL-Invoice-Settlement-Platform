import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class TripNumberService {
  private periodFor(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}${m}`;
  }

  async nextTripNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    on: Date = new Date(),
  ): Promise<string> {
    const period = this.periodFor(on);

    const existing = await tx.counter.findFirst({
      where: {
        organizationId,
        entityType: "TRIP",
        period,
      },
    });

    let counter;
    if (existing) {
      counter = await tx.counter.update({
        where: { id: existing.id },
        data: { lastValue: { increment: 1 } },
      });
    } else {
      try {
        counter = await tx.counter.create({
          data: {
            organizationId,
            entityType: "TRIP",
            period,
            lastValue: 1,
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          const retry = await tx.counter.findFirst({
            where: { organizationId, entityType: "TRIP", period },
          });
          counter = await tx.counter.update({
            where: { id: retry!.id },
            data: { lastValue: { increment: 1 } },
          });
        } else {
          throw err;
        }
      }
    }

    const seq = String(counter.lastValue).padStart(4, "0");
    return `TRP-${period}-${seq}`;
  }
}
