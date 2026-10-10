import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { DisputeNumberService } from "./dispute-number.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { UpdateDisputeStatusDto } from "./dto/update-dispute-status.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";
import { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import { PostMessageDto } from "./dto/post-message.dto";

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputeNumbers: DisputeNumberService,
  ) {}

  async list(query: ListDisputesQueryDto) {
    const where: Prisma.DisputeWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.invoiceId) where.invoiceLine = { invoiceId: query.invoiceId };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { disputeNumber: { contains: search, mode: "insensitive" } },
        { reasonCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          invoiceLine: { select: { id: true, invoiceId: true, tripId: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string) {
    const dispute = await this.prisma.dispute.findFirst({
      where: { id },
      include: {
        invoiceLine: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, status: true } },
            trip: { select: { id: true, tripNumber: true } },
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!dispute) throw new NotFoundException("Dispute not found.");
    return dispute;
  }

  async create(dto: CreateDisputeDto, raisedById: string) {
    const { organizationId } = requireTenant();

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLine.findFirst({
        where: { id: dto.invoiceLineId },
        include: { invoice: true },
      });
      if (!line) throw new NotFoundException("Invoice line not found.");

      if (line.invoice.status === "DRAFT" || line.invoice.status === "CANCELLED") {
        throw new BadRequestException(
          `Cannot raise dispute on invoice in ${line.invoice.status} status.`,
        );
      }

      const existing = await tx.dispute.findFirst({
        where: { invoiceLineId: dto.invoiceLineId },
      });
      if (existing) {
        throw new ConflictException("An open dispute already exists for this invoice line.");
      }

      if (dto.amountPaise > line.totalAmount) {
        throw new BadRequestException("Disputed amount cannot exceed line total.");
      }

      const disputeNumber = await this.disputeNumbers.nextDisputeNumber(tx, organizationId);

      const dispute = await tx.dispute.create({
        data: {
          organizationId,
          disputeNumber,
          invoiceLineId: dto.invoiceLineId,
          raisedById,
          reasonCode: dto.reasonCode,
          comment: dto.comment,
          evidenceDocId: dto.evidenceDocId ?? null,
          amountPaise: dto.amountPaise,
          status: "DISPUTED",
        },
      });

      // Auto-transition invoice to DISPUTED if it's in CLIENT_REVIEW
      if (line.invoice.status === "CLIENT_REVIEW") {
        await tx.invoice.updateMany({
          where: { id: line.invoiceId, status: "CLIENT_REVIEW" },
          data: { status: "DISPUTED", version: { increment: 1 } },
        });
      }

      return dispute;
    });
  }

  async updateStatus(id: string, dto: UpdateDisputeStatusDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findFirst({ where: { id } });
      if (!dispute) throw new NotFoundException("Dispute not found.");

      if (dispute.version !== dto.version) {
        throw new ConflictException(`Stale version. Expected ${dto.version}, found ${dispute.version}.`);
      }
      if (dispute.status !== "DISPUTED") {
        throw new BadRequestException(`Cannot transition dispute from ${dispute.status} to ${dto.status}.`);
      }

      const updated = await tx.dispute.updateMany({
        where: { id, version: dto.version, status: "DISPUTED" },
        data: { status: "UNDER_REVIEW", version: { increment: 1 } },
      });
      if (updated.count === 0) throw new ConflictException("Dispute state changed during update.");
      return tx.dispute.findUniqueOrThrow({ where: { id } });
    });
  }

  async resolve(id: string, dto: ResolveDisputeDto, resolvedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findFirst({ where: { id } });
      if (!dispute) throw new NotFoundException("Dispute not found.");

      if (dispute.version !== dto.version) {
        throw new ConflictException(`Stale version. Expected ${dto.version}, found ${dispute.version}.`);
      }
      if (dispute.status !== "UNDER_REVIEW" && dispute.status !== "DISPUTED") {
        throw new BadRequestException(`Cannot resolve dispute in ${dispute.status} status.`);
      }

      const updated = await tx.dispute.updateMany({
        where: { id, version: dto.version, status: dispute.status },
        data: {
          status: "RESOLVED",
          resolution: dto.resolution,
          resolutionNotes: dto.resolutionNotes,
          resolvedById,
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new ConflictException("Dispute state changed during update.");

      // If ACCEPTED or PARTIAL_ADJUSTMENT, adjust the invoice line amount
      if (dto.resolution === "ACCEPTED" || dto.resolution === "PARTIAL_ADJUSTMENT") {
        const line = await tx.invoiceLine.findUnique({ where: { id: dispute.invoiceLineId } });
        if (line) {
          const adjustment = dto.resolution === "ACCEPTED" ? dispute.amountPaise : Math.floor(dispute.amountPaise / 2);
          const newLineAmount = Math.max(0, line.lineAmount - adjustment);
          const newGstAmount = Math.round(newLineAmount * 0.18);
          const newTotal = newLineAmount + newGstAmount;

          await tx.invoiceLine.update({
            where: { id: line.id },
            data: {
              lineAmount: newLineAmount,
              gstAmount: newGstAmount,
              totalAmount: newTotal,
            },
          });

          // Recalculate invoice header totals
          const allLines = await tx.invoiceLine.findMany({
            where: { invoiceId: line.invoiceId },
          });
          const subtotal = allLines.reduce((s, l) => s + l.lineAmount, 0);
          const gstAmount = allLines.reduce((s, l) => s + l.gstAmount, 0);
          const total = subtotal + gstAmount;

          await tx.invoice.update({
            where: { id: line.invoiceId },
            data: { subtotal, gstAmount, total },
          });
        }
      }

      return tx.dispute.findUniqueOrThrow({ where: { id } });
    });
  }

  async listMessages(disputeId: string) {
    const dispute = await this.prisma.dispute.findFirst({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException("Dispute not found.");

    return this.prisma.message.findMany({
      where: { disputeId },
      orderBy: { createdAt: "asc" },
    });
  }

  async postMessage(disputeId: string, dto: PostMessageDto, authorId: string) {
    const { organizationId } = requireTenant();

    const dispute = await this.prisma.dispute.findFirst({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException("Dispute not found.");
    if (dispute.status === "RESOLVED") {
      throw new BadRequestException("Cannot post messages to a resolved dispute.");
    }

    return this.prisma.message.create({
      data: {
        organizationId,
        disputeId,
        authorId,
        body: dto.body.trim(),
      },
    });
  }
}
