import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { tenantStorage } from "../core/tenant/tenant.context";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      invoice: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockPrisma = {
      invoice: {
        findFirst: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };

    service = new PaymentsService(mockPrisma as unknown as PrismaService);
  });

  it("1. recordPayment() throws NotFoundException when invoice not found", async () => {
    mockTx.invoice.findFirst.mockResolvedValue(null);

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      await expect(
        service.recordPayment("inv-1", {
          amount: 10000,
          method: "BANK_TRANSFER",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it("2. recordPayment() throws BadRequestException when invoice is DRAFT", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "DRAFT",
      total: 50000,
    });

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      await expect(
        service.recordPayment("inv-1", {
          amount: 10000,
          method: "BANK_TRANSFER",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it("3. recordPayment() throws BadRequestException when invoice is CLIENT_REVIEW", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "CLIENT_REVIEW",
      total: 50000,
    });

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      await expect(
        service.recordPayment("inv-1", {
          amount: 10000,
          method: "BANK_TRANSFER",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it("4. recordPayment() creates Payment and transitions APPROVED → PAYMENT_QUEUED", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "APPROVED",
      total: 50000,
    });
    mockTx.payment.create.mockResolvedValue({
      id: "pay-1",
      amount: 20000,
      method: "UPI",
    });
    mockTx.payment.findMany.mockResolvedValue([{ amount: 20000 }]);

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      const result = await service.recordPayment("inv-1", {
        amount: 20000,
        method: "UPI",
      });

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-123",
          invoiceId: "inv-1",
          amount: 20000,
          method: "UPI",
        }),
      });
      expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: "inv-1", status: "APPROVED" },
        data: { status: "PAYMENT_QUEUED", version: { increment: 1 } },
      });
      expect(result.invoiceStatus).toBe("PAYMENT_QUEUED");
      expect(result.totalPaidPaise).toBe(20000);
    });
  });

  it("5. recordPayment() transitions to PAID when totalPaid >= invoice.total", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "PAYMENT_QUEUED",
      total: 50000,
    });
    mockTx.payment.create.mockResolvedValue({
      id: "pay-2",
      amount: 30000,
      method: "BANK_TRANSFER",
    });
    mockTx.payment.findMany.mockResolvedValue([{ amount: 20000 }, { amount: 30000 }]);

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      const result = await service.recordPayment("inv-1", {
        amount: 30000,
        method: "BANK_TRANSFER",
      });

      expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: "inv-1", status: "PAYMENT_QUEUED" },
        data: { status: "PAID", version: { increment: 1 } },
      });
      expect(result.invoiceStatus).toBe("PAID");
      expect(result.totalPaidPaise).toBe(50000);
      expect(result.remainingPaise).toBe(0);
    });
  });

  it("6. recordPayment() returns remainingPaise = max(0, total - paid)", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "APPROVED",
      total: 50000,
    });
    mockTx.payment.create.mockResolvedValue({
      id: "pay-1",
      amount: 15000,
      method: "CASH",
    });
    mockTx.payment.findMany.mockResolvedValue([{ amount: 15000 }]);

    await tenantStorage.run({ organizationId: "org-123", userId: "usr-123" }, async () => {
      const result = await service.recordPayment("inv-1", {
        amount: 15000,
        method: "CASH",
      });

      expect(result.invoiceTotalPaise).toBe(50000);
      expect(result.totalPaidPaise).toBe(15000);
      expect(result.remainingPaise).toBe(35000);

      mockTx.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "PAYMENT_QUEUED",
        total: 50000,
      });
      mockTx.payment.findMany.mockResolvedValue([{ amount: 60000 }]);
      const overpaidResult = await service.recordPayment("inv-1", {
        amount: 60000,
        method: "CASH",
      });
      expect(overpaidResult.remainingPaise).toBe(0);
    });
  });

  it("7. markPaid() throws when invoice already PAID", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "PAID",
      total: 50000,
    });

    await expect(service.markPaid("inv-1")).rejects.toThrow(BadRequestException);
  });

  it("8. markPaid() transitions APPROVED → PAID", async () => {
    mockTx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "APPROVED",
      total: 50000,
    });
    mockTx.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv-1",
      status: "PAID",
      total: 50000,
    });

    const result = await service.markPaid("inv-1");

    expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", status: "APPROVED" },
      data: { status: "PAID", version: { increment: 1 } },
    });
    expect(result.status).toBe("PAID");
  });
});
