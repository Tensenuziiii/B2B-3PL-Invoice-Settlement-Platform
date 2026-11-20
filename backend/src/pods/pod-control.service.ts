import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { SubmitChecklistDto } from "./dto/pod-checklist.dto";
import { PodHoldDto, PodReleaseHoldDto } from "./dto/pod-hold.dto";
import { PodCourierDto, PodMarkLostDto, PodDuplicateRequestDto } from "./dto/pod-physical.dto";

@Injectable()
export class PodControlService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Retrieve ────────────────────────────────────────────────────────────────

  async getByTripId(tripId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.prisma.pod.findFirst({
      where: { tripId, organizationId },
      include: {
        checkItems: { orderBy: { checkedAt: "asc" } },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!pod) throw new NotFoundException("POD not found for this trip.");
    return pod;
  }

  async getById(podId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.prisma.pod.findFirst({
      where: { id: podId, organizationId },
      include: {
        checkItems: { orderBy: { checkedAt: "asc" } },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!pod) throw new NotFoundException("POD not found.");
    return pod;
  }

  // ─── Auto-creation on DELIVERED transition ────────────────────────────────────

  /**
   * Called by TripsService.transitionStatus() when toStatus === 'DELIVERED'.
   * Idempotent — if the POD already exists, returns existing.
   */
  async ensurePodForTrip(
    tripId: string,
    organizationId: string,
    actorId: string,
  ) {
    const existing = await this.prisma.pod.findFirst({ where: { tripId } });
    if (existing) return existing;

    const pod = await this.prisma.pod.create({
      data: {
        organizationId,
        tripId,
        currentStatus: "PENDING_DELIVERY",
        deliveredAt: new Date(),
        events: {
          create: {
            organizationId,
            fromStatus: null,
            toStatus: "PENDING_DELIVERY",
            actorId,
            reason: "Auto-created on trip delivery",
          },
        },
      },
      include: {
        checkItems: true,
        events: true,
      },
    });

    return pod;
  }

  // ─── Checklist Submission ─────────────────────────────────────────────────────

  /**
   * Submit or update checklist results for a POD.
   * Transitions: PENDING_DELIVERY / SOFT_COPY_RECEIVED → SOFT_COPY_CHECKED (all PASS/WAIVED)
   *           or → ON_HOLD (any FAIL)
   * Requires pod to NOT already be ACKNOWLEDGED, LOST, or DUPLICATE_REQUESTED.
   */
  async submitChecklist(podId: string, dto: SubmitChecklistDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    const lockedStatuses = ["ACKNOWLEDGED", "LOST", "DUPLICATE_REQUESTED"];
    if (lockedStatuses.includes(pod.currentStatus)) {
      throw new BadRequestException(
        `Cannot submit checklist for POD in status ${pod.currentStatus}.`,
      );
    }

    if (dto.items.length === 0) {
      throw new BadRequestException("Checklist must contain at least one item.");
    }

    // Upsert each check item (@@unique [podId, itemCode])
    for (const item of dto.items) {
      const existingItem = await this.prisma.podCheckItem.findFirst({
        where: { podId, itemCode: item.itemCode },
      });

      if (existingItem) {
        await this.prisma.podCheckItem.update({
          where: { id: existingItem.id },
          data: {
            result: item.result,
            notes: item.notes ?? null,
            checkedById: actorId,
            checkedAt: new Date(),
          },
        });
      } else {
        await this.prisma.podCheckItem.create({
          data: {
            organizationId,
            podId,
            itemCode: item.itemCode,
            result: item.result,
            notes: item.notes ?? null,
            checkedById: actorId,
          },
        });
      }
    }

    // Determine new status based on results
    const anyFail = dto.items.some((i) => i.result === "FAIL");
    const newStatus = anyFail ? "ON_HOLD" : "SOFT_COPY_CHECKED";

    const prevStatus = pod.currentStatus;
    const updateData: any = {
      currentStatus: newStatus,
      events: {
        create: {
          organizationId,
          fromStatus: prevStatus,
          toStatus: newStatus,
          actorId,
          reason: anyFail
            ? "Checklist failed — POD placed on hold"
            : "Checklist passed",
        },
      },
    };

    if (anyFail) {
      // Auto-populate hold reason if checklist fails
      const failedItems = dto.items.filter((i) => i.result === "FAIL").map((i) => i.itemCode).join(", ");
      updateData.holdReason = "Checklist failure";
      updateData.holdRemarks = `Failed items: ${failedItems}`;
    } else {
      // Clear hold fields on successful checklist
      updateData.holdReason = null;
      updateData.holdRemarks = null;
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: updateData,
      include: {
        checkItems: { orderBy: { checkedAt: "asc" } },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
  }

  // ─── Hold Management ──────────────────────────────────────────────────────────

  async placeOnHold(podId: string, dto: PodHoldDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus === "ON_HOLD") {
      throw new ConflictException("POD is already on hold.");
    }

    const lockedStatuses = ["ACKNOWLEDGED", "LOST", "DUPLICATE_REQUESTED"];
    if (lockedStatuses.includes(pod.currentStatus)) {
      throw new BadRequestException(
        `Cannot place POD in status ${pod.currentStatus} on hold.`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "ON_HOLD",
        holdReason: dto.reason,
        holdRemarks: dto.remarks,
        events: {
          create: {
            organizationId,
            fromStatus: pod.currentStatus,
            toStatus: "ON_HOLD",
            actorId,
            reason: dto.reason,
            remarks: dto.remarks,
          },
        },
      },
      include: {
        checkItems: true,
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
  }

  async releaseHold(podId: string, dto: PodReleaseHoldDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "ON_HOLD") {
      throw new BadRequestException("POD is not on hold — cannot release.");
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "SOFT_COPY_RECEIVED",
        holdReason: null,
        holdRemarks: null,
        events: {
          create: {
            organizationId,
            fromStatus: "ON_HOLD",
            toStatus: "SOFT_COPY_RECEIVED",
            actorId,
            reason: dto.reason,
          },
        },
      },
      include: {
        checkItems: true,
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
  }

  // ─── Soft-copy receipt ────────────────────────────────────────────────────────

  /**
   * Staff manually marks soft copy received (image uploaded).
   * Transitions PENDING_DELIVERY → SOFT_COPY_RECEIVED.
   */
  async markSoftCopyReceived(podId: string, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "PENDING_DELIVERY") {
      throw new BadRequestException(
        `Cannot mark soft copy received — current status is ${pod.currentStatus}.`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "SOFT_COPY_RECEIVED",
        events: {
          create: {
            organizationId,
            fromStatus: "PENDING_DELIVERY",
            toStatus: "SOFT_COPY_RECEIVED",
            actorId,
            reason: "Soft copy received by staff",
          },
        },
      },
      include: {
        checkItems: true,
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
  }

  // ─── Physical POD Tracking (R1-TASK-5.2) ────────────────────────────────────

  async dispatchCourier(podId: string, dto: PodCourierDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "SOFT_COPY_CHECKED") {
      throw new BadRequestException(
        `Cannot dispatch courier — POD must be SOFT_COPY_CHECKED (currently ${pod.currentStatus}).`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "ORIGINAL_DISPATCHED",
        courierName: dto.courierName,
        courierTrackingNo: dto.courierTrackingNo ?? null,
        courierDispatchedAt: new Date(),
        events: {
          create: {
            organizationId,
            fromStatus: "SOFT_COPY_CHECKED",
            toStatus: "ORIGINAL_DISPATCHED",
            actorId,
            reason: `Dispatched via ${dto.courierName}${dto.courierTrackingNo ? ` (${dto.courierTrackingNo})` : ""}`,
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async markOriginalReceived(podId: string, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "ORIGINAL_DISPATCHED") {
      throw new BadRequestException(
        `Cannot mark original received — POD must be ORIGINAL_DISPATCHED (currently ${pod.currentStatus}).`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "ORIGINAL_RECEIVED",
        originalReceivedAt: new Date(),
        events: {
          create: {
            organizationId,
            fromStatus: "ORIGINAL_DISPATCHED",
            toStatus: "ORIGINAL_RECEIVED",
            actorId,
            reason: "Original POD received in office",
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async markLost(podId: string, dto: PodMarkLostDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    const allowedFrom = ["ORIGINAL_DISPATCHED", "ORIGINAL_RECEIVED"];
    if (!allowedFrom.includes(pod.currentStatus)) {
      throw new BadRequestException(
        `Cannot mark POD lost from status ${pod.currentStatus}. Allowed: ${allowedFrom.join(", ")}.`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "LOST",
        events: {
          create: {
            organizationId,
            fromStatus: pod.currentStatus,
            toStatus: "LOST",
            actorId,
            reason: dto.reason,
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async requestDuplicate(podId: string, dto: PodDuplicateRequestDto, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "LOST") {
      throw new BadRequestException(
        `Cannot request duplicate — POD must be LOST (currently ${pod.currentStatus}).`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "DUPLICATE_REQUESTED",
        events: {
          create: {
            organizationId,
            fromStatus: "LOST",
            toStatus: "DUPLICATE_REQUESTED",
            actorId,
            reason: "Duplicate POD requested from customer",
            remarks: dto.notes,
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async submitToClient(podId: string, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "ORIGINAL_RECEIVED") {
      throw new BadRequestException(
        `Cannot submit to client — POD must be ORIGINAL_RECEIVED (currently ${pod.currentStatus}).`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "SUBMITTED_TO_CLIENT",
        submittedToClientAt: new Date(),
        events: {
          create: {
            organizationId,
            fromStatus: "ORIGINAL_RECEIVED",
            toStatus: "SUBMITTED_TO_CLIENT",
            actorId,
            reason: "Original POD submitted to client",
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }

  async acknowledgeReceipt(podId: string, actorId: string) {
    const { organizationId } = requireTenant();
    const pod = await this.getById(podId);

    if (pod.currentStatus !== "SUBMITTED_TO_CLIENT") {
      throw new BadRequestException(
        `Cannot acknowledge — POD must be SUBMITTED_TO_CLIENT (currently ${pod.currentStatus}).`,
      );
    }

    return this.prisma.pod.update({
      where: { id: podId },
      data: {
        currentStatus: "ACKNOWLEDGED",
        events: {
          create: {
            organizationId,
            fromStatus: "SUBMITTED_TO_CLIENT",
            toStatus: "ACKNOWLEDGED",
            actorId,
            reason: "Client acknowledged receipt of original POD",
          },
        },
      },
      include: { checkItems: true, events: { orderBy: { occurredAt: "asc" } } },
    });
  }
}
