import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { canInvoiceTransition } from "./invoice-state.machine";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { InvoiceActionDto } from "./dto/invoice-action.dto";

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
