import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { canInvoiceTransition } from "./invoice-state.machine";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { InvoiceActionDto } from "./dto/invoice-action.dto";
import { GenerateFromPodDto } from "./dto/generate-from-pod.dto";
import { ApproveStageDto, HoldStageDto, ReleaseStageHoldDto } from "./dto/stage-action.dto";
import { CreateFollowUpDto } from "./dto/create-follow-up.dto";
import { InvoiceNumberService } from "../billing/invoice-number.service";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceNumber: InvoiceNumberService,
  ) {}

  async list(query: ListInvoicesQueryDto) {
    const where: Prisma.InvoiceWhereInput = { deletedAt: null };

    if (query.status) where.status = query.status as any;
    if (query.clientId) where.clientId = query.clientId;

    if (query.fromDate || query.toDate) {
      where.issueDate = {};
      if (query.fromDate) where.issueDate.gte = new Date(query.fromDate);
      if (query.toDate) where.issueDate.lte = new Date(query.toDate);
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          client: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        pod: true,
        stages: { orderBy: { sequence: "asc" } },
        followUps: { orderBy: { contactedOn: "desc" } },
        lines: {
          include: {
            trip: {
              select: {
                id: true,
                tripNumber: true,
                origin: true,
                destination: true,
                deliveredAt: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found.");
    return invoice;
  }

  async generateFromPod(dto: GenerateFromPodDto, actorId: string) {
    const { organizationId } = requireTenant();

    const pod = await this.prisma.pod.findFirst({
      where: { id: dto.podId, organizationId },
      include: {
        trip: {
          include: {
            client: true,
            tripStops: true,
          },
        },
      },
    });

    if (!pod) throw new NotFoundException("POD not found.");

    if (pod.invoiceId) {
      throw new ConflictException("An invoice has already been generated for this POD.");
    }

    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { podId: pod.id, organizationId, deletedAt: null },
    });
    if (existingInvoice) {
      throw new ConflictException("An invoice is already linked to this POD.");
    }

    // Acceptance Criteria 1: Invoice cannot be created for an unverified or on-hold POD
    const verifiedStatuses = [
      "SOFT_COPY_CHECKED",
      "ORIGINAL_DISPATCHED",
      "ORIGINAL_RECEIVED",
      "SUBMITTED_TO_CLIENT",
      "ACKNOWLEDGED",
    ];
    if (!verifiedStatuses.includes(pod.currentStatus) || pod.currentStatus === "ON_HOLD") {
      throw new BadRequestException(
        `Cannot generate invoice for POD in status ${pod.currentStatus}. POD must be verified (SOFT_COPY_CHECKED or later) and not on hold.`,
      );
    }

    if (!pod.trip) {
      throw new BadRequestException("POD is not linked to any trip.");
    }
    if (!pod.trip.clientId) {
      throw new BadRequestException("Trip has no client counterparty.");
    }

    const clientId = pod.trip.clientId;
    const client = pod.trip.client;

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else if (client?.creditDays) {
      dueDate = new Date(issueDate.getTime() + client.creditDays * 24 * 60 * 60 * 1000);
    }

    // Mathematical precision: calculate subtotal, GST, total
    const subtotal = dto.subtotal ?? 0;
    const gstRate = dto.gstRate ?? 18;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const total = subtotal + gstAmount;

    // Fetch ordered stage templates for this client
    const templates = await this.prisma.approvalStageTemplate.findMany({
      where: { clientId, organizationId },
      orderBy: { sequence: "asc" },
    });

    const stageData =
      templates.length > 0
        ? templates.map((t, idx) => ({
            organizationId,
            sequence: t.sequence,
            name: t.name,
            status: idx === 0 ? "ACTIVE" : "PENDING",
          }))
        : [
            { organizationId, sequence: 1, name: "POD Verification", status: "ACTIVE" },
            { organizationId, sequence: 2, name: "Commercial Approval", status: "PENDING" },
            { organizationId, sequence: 3, name: "Finance Authorization", status: "PENDING" },
          ];

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.invoiceNumber.nextInvoiceNumber(
        tx,
        organizationId,
        issueDate,
      );

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          status: "DRAFT",
          clientId,
          podId: pod.id,
          issueDate,
          dueDate,
          subtotal,
          gstRate,
          gstAmount,
          total,
        },
      });

      // Link POD to this invoice
      await tx.pod.update({
        where: { id: pod.id },
        data: { invoiceId: invoice.id },
      });

      // Create invoice line linked to the trip
      await tx.invoiceLine.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          tripId: pod.tripId,
          lineAmount: subtotal,
          gstAmount,
          totalAmount: total,
          snapshot: {
            tripNumber: pod.trip.tripNumber,
            origin: pod.trip.origin,
            destination: pod.trip.destination,
            lrNumber: pod.trip.lrNumber,
            deliveredAt: pod.trip.deliveredAt,
          },
        },
      });

      // Snapshot customer approval stage templates
      await tx.invoiceStage.createMany({
        data: stageData.map((s) => ({
          ...s,
          invoiceId: invoice.id,
        })),
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          client: true,
          stages: { orderBy: { sequence: "asc" } },
          lines: true,
          pod: true,
        },
      });
    });
  }

  async submit(id: string, dto: InvoiceActionDto, user: { sub: string; role: string }) {
    return this.transition(id, dto, "SUBMITTED", { submittedAt: new Date() } as any);
  }

  async sendToClient(id: string, dto: InvoiceActionDto, user: { sub: string; role: string }) {
    return this.transition(id, dto, "CLIENT_REVIEW", {});
  }

  async approve(id: string, dto: InvoiceActionDto, user: { sub: string; role: string }) {
    return this.transition(id, dto, "APPROVED", { approvedAt: new Date() } as any);
  }

  async reject(id: string, dto: InvoiceActionDto, user: { sub: string; role: string }) {
    return this.transition(id, dto, "REJECTED", { rejectedAt: new Date() } as any);
  }

  async cancel(id: string, dto: InvoiceActionDto, user: { sub: string; role: string }) {
    return this.transition(id, dto, "CANCELLED", { cancelledAt: new Date(), deletedAt: new Date() } as any);
  }

  private async transition(
    id: string,
    dto: InvoiceActionDto,
    targetStatus: string,
    extra: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, deletedAt: null } });
      if (!invoice) throw new NotFoundException("Invoice not found.");

      if (invoice.version !== dto.version) {
        throw new ConflictException(
          `Invoice was modified. Expected version ${dto.version}, found ${invoice.version}.`,
        );
      }

      if (!canInvoiceTransition(invoice.status, targetStatus)) {
        throw new BadRequestException(
          `Cannot transition invoice from ${invoice.status} to ${targetStatus}.`,
        );
      }

      const updated = await tx.invoice.updateMany({
        where: { id, version: dto.version, status: invoice.status },
        data: {
          status: targetStatus as any,
          version: { increment: 1 },
          ...extra,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException("Invoice state changed during update.");
      }

      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });
  }

  // ─── Approval Stages (R1-TASK-6.2) ──────────────────────────────────────────

  async listStages(invoiceId: string) {
    await this.get(invoiceId);
    return this.prisma.invoiceStage.findMany({
      where: { invoiceId },
      orderBy: { sequence: "asc" },
    });
  }

  async approveStage(invoiceId: string, stageId: string, dto: ApproveStageDto, actorId: string) {
    const { organizationId } = requireTenant();
    const invoice = await this.get(invoiceId);

    const stage = await this.prisma.invoiceStage.findFirst({
      where: { id: stageId, invoiceId, organizationId },
    });
    if (!stage) throw new NotFoundException("Invoice stage not found.");

    if (stage.status === "APPROVED") {
      throw new BadRequestException("Stage is already approved.");
    }
    if (stage.status === "ON_HOLD") {
      throw new BadRequestException("Stage is on hold — release hold before approving.");
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark current stage approved
      await tx.invoiceStage.update({
        where: { id: stageId },
        data: {
          status: "APPROVED",
          approvedById: actorId,
          approvedAt: new Date(),
          remarks: dto.remarks ?? stage.remarks,
        },
      });

      // 2. Check for next stage
      const nextStage = await tx.invoiceStage.findFirst({
        where: {
          invoiceId,
          sequence: stage.sequence + 1,
        },
      });

      let newInvoiceStatus = invoice.status;
      if (nextStage) {
        // Activate next stage
        await tx.invoiceStage.update({
          where: { id: nextStage.id },
          data: { status: "ACTIVE" },
        });
        newInvoiceStatus = "IN_STAGE";
      } else {
        // All stages approved!
        newInvoiceStatus = "FULLY_APPROVED";
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newInvoiceStatus as any,
          approvedAt: newInvoiceStatus === "FULLY_APPROVED" ? new Date() : undefined,
          version: { increment: 1 },
        },
      });

      return tx.invoiceStage.findMany({
        where: { invoiceId },
        orderBy: { sequence: "asc" },
      });
    });
  }

  async holdStage(invoiceId: string, stageId: string, dto: HoldStageDto, actorId: string) {
    const { organizationId } = requireTenant();
    await this.get(invoiceId);

    const stage = await this.prisma.invoiceStage.findFirst({
      where: { id: stageId, invoiceId, organizationId },
    });
    if (!stage) throw new NotFoundException("Invoice stage not found.");

    if (stage.status === "ON_HOLD") {
      throw new ConflictException("Stage is already on hold.");
    }
    if (stage.status === "APPROVED") {
      throw new BadRequestException("Cannot put an approved stage on hold.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceStage.update({
        where: { id: stageId },
        data: {
          status: "ON_HOLD",
          remarks: dto.reason + (dto.remarks ? `: ${dto.remarks}` : ""),
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "ON_HOLD",
          version: { increment: 1 },
        },
      });

      return tx.invoiceStage.findMany({
        where: { invoiceId },
        orderBy: { sequence: "asc" },
      });
    });
  }

  async releaseStageHold(invoiceId: string, stageId: string, dto: ReleaseStageHoldDto, actorId: string) {
    const { organizationId } = requireTenant();
    await this.get(invoiceId);

    const stage = await this.prisma.invoiceStage.findFirst({
      where: { id: stageId, invoiceId, organizationId },
    });
    if (!stage) throw new NotFoundException("Invoice stage not found.");

    if (stage.status !== "ON_HOLD") {
      throw new BadRequestException("Stage is not on hold.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceStage.update({
        where: { id: stageId },
        data: {
          status: "ACTIVE",
          remarks: dto.remarks ?? stage.remarks,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "IN_STAGE",
          version: { increment: 1 },
        },
      });

      return tx.invoiceStage.findMany({
        where: { invoiceId },
        orderBy: { sequence: "asc" },
      });
    });
  }

  // ─── Follow-Up CRM (R1-TASK-6.2) ───────────────────────────────────────────

  async listFollowUps(invoiceId: string) {
    await this.get(invoiceId);
    return this.prisma.invoiceFollowUp.findMany({
      where: { invoiceId },
      orderBy: { contactedOn: "desc" },
    });
  }

  async createFollowUp(invoiceId: string, dto: CreateFollowUpDto, actorId: string) {
    const { organizationId } = requireTenant();
    await this.get(invoiceId);

    return this.prisma.invoiceFollowUp.create({
      data: {
        organizationId,
        invoiceId,
        contactedOn: dto.contactedOn ? new Date(dto.contactedOn) : new Date(),
        contactPerson: dto.contactPerson?.trim() || null,
        outcome: dto.outcome,
        remarks: dto.remarks?.trim() || null,
        nextFollowUpOn: dto.nextFollowUpOn ? new Date(dto.nextFollowUpOn) : null,
        loggedById: actorId,
      },
    });
  }
}
