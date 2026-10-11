import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { RecordPaymentDto } from "./dto/record-payment.dto";

const PAYABLE_STATUSES = ["APPROVED", "PAYMENT_QUEUED"];

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found.");

    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: "desc" },
    });
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto) {
    const { organizationId } = requireTenant();

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, deletedAt: null },
      });
      if (!invoice) throw new NotFoundException("Invoice not found.");

      if (!PAYABLE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot record payment on invoice in ${invoice.status} status. Expected APPROVED or PAYMENT_QUEUED.`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          organizationId,
          invoiceId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        },
      });

      // Sum all payments
      const allPayments = await tx.payment.findMany({
        where: { invoiceId },
        select: { amount: true },
      });
      const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

      let newStatus = invoice.status;
      if (invoice.status === "APPROVED") {
        newStatus = "PAYMENT_QUEUED";
      }
      if (totalPaid >= invoice.total) {
        newStatus = "PAID";
      }

      if (newStatus !== invoice.status) {
        await tx.invoice.updateMany({
          where: { id: invoiceId, status: invoice.status },
          data: { status: newStatus as any, version: { increment: 1 } },
        });
      }

      return {
        payment,
        invoiceStatus: newStatus,
        totalPaidPaise: totalPaid,
        invoiceTotalPaise: invoice.total,
        remainingPaise: Math.max(0, invoice.total - totalPaid),
      };
    });
  }

  async markPaid(invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, deletedAt: null },
      });
      if (!invoice) throw new NotFoundException("Invoice not found.");

      if (invoice.status === "PAID") {
        throw new BadRequestException("Invoice is already marked paid.");
      }
      if (!PAYABLE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot mark invoice paid from ${invoice.status} status.`,
        );
      }

      const updated = await tx.invoice.updateMany({
        where: { id: invoiceId, status: invoice.status },
        data: { status: "PAID", version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new BadRequestException("Invoice state changed during update.");
      }

      return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    });
  }
}
