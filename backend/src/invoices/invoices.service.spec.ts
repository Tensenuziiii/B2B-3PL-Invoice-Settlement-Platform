import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { PrismaService } from "../prisma/prisma.service";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let mockInvoiceFindMany: jest.Mock;
  let mockInvoiceCount: jest.Mock;
  let mockInvoiceFindFirst: jest.Mock;
  let mockTx: any;
  let mockPrismaService: any;

  const mockInvoice = {
    id: "inv-123",
    organizationId: "org-123",
    invoiceNumber: "INV-202610-0001",
    status: "DRAFT",
    version: 0,
    clientId: "cli-123",
    issueDate: new Date("2026-10-10T10:00:00.000Z"),
    dueDate: new Date("2026-11-10T10:00:00.000Z"),
    periodStart: new Date("2026-10-01T00:00:00.000Z"),
    periodEnd: new Date("2026-10-10T23:59:59.000Z"),
    subtotal: 100000,
    gstRate: 18,
    gstAmount: 18000,
    total: 118000,
    createdAt: new Date("2026-10-10T10:00:00.000Z"),
    updatedAt: new Date("2026-10-10T10:00:00.000Z"),
    deletedAt: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    client: { id: "cli-123", name: "Client A", code: "CLI-A" },
    lines: [],
    payments: [],
  };

  beforeEach(() => {
    mockInvoiceFindMany = jest.fn();
    mockInvoiceCount = jest.fn();
    mockInvoiceFindFirst = jest.fn();
    mockTx = {
      invoice: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    mockPrismaService = {
      invoice: {
        findMany: mockInvoiceFindMany,
        count: mockInvoiceCount,
        findFirst: mockInvoiceFindFirst,
      },
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };
    service = new InvoicesService(mockPrismaService as unknown as PrismaService);
  });

  it("1. list() filters by status", async () => {
    mockInvoiceFindMany.mockResolvedValueOnce([mockInvoice]);
    mockInvoiceCount.mockResolvedValueOnce(1);

    const res = await service.list({ status: "DRAFT" });

    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: "DRAFT",
        }),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it("2. list() filters by clientId", async () => {
    mockInvoiceFindMany.mockResolvedValueOnce([mockInvoice]);
    mockInvoiceCount.mockResolvedValueOnce(1);

    const res = await service.list({ clientId: "cli-123" });

    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          clientId: "cli-123",
        }),
      }),
    );
    expect(res.data).toHaveLength(1);
  });

  it("3. list() applies date range on issueDate", async () => {
    mockInvoiceFindMany.mockResolvedValueOnce([mockInvoice]);
    mockInvoiceCount.mockResolvedValueOnce(1);

    await service.list({
      fromDate: "2026-10-01T00:00:00.000Z",
      toDate: "2026-10-15T00:00:00.000Z",
    });

    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          issueDate: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lte: new Date("2026-10-15T00:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("4. get() throws NotFoundException when not found", async () => {
    mockInvoiceFindFirst.mockResolvedValueOnce(null);

    await expect(service.get("non-existent-id")).rejects.toThrow(NotFoundException);
  });

  it("5. transition() throws ConflictException on stale version", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "DRAFT",
      version: 2,
    });

    await expect(
      service.submit("inv-123", { version: 1 }, { sub: "usr-1", role: "ACCOUNTS" }),
    ).rejects.toThrow(ConflictException);
  });

  it("6. submit() transitions DRAFT → SUBMITTED", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "DRAFT",
      version: 0,
    });
    mockTx.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      ...mockInvoice,
      status: "SUBMITTED",
      version: 1,
      submittedAt: new Date(),
    });

    const res = await service.submit(
      "inv-123",
      { version: 0 },
      { sub: "usr-1", role: "ACCOUNTS" },
    );

    expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-123", version: 0, status: "DRAFT" },
      data: expect.objectContaining({
        status: "SUBMITTED",
        version: { increment: 1 },
        submittedAt: expect.any(Date),
      }),
    });
    expect(res.status).toBe("SUBMITTED");
  });

  it("7. submit() rejects when status is SUBMITTED (invalid transition)", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "SUBMITTED",
      version: 1,
    });

    await expect(
      service.submit("inv-123", { version: 1 }, { sub: "usr-1", role: "ACCOUNTS" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("8. approve() transitions CLIENT_REVIEW → APPROVED", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "CLIENT_REVIEW",
      version: 1,
    });
    mockTx.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      ...mockInvoice,
      status: "APPROVED",
      version: 2,
      approvedAt: new Date(),
    });

    const res = await service.approve(
      "inv-123",
      { version: 1 },
      { sub: "usr-1", role: "CLIENT_AP" },
    );

    expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-123", version: 1, status: "CLIENT_REVIEW" },
      data: expect.objectContaining({
        status: "APPROVED",
        version: { increment: 1 },
        approvedAt: expect.any(Date),
      }),
    });
    expect(res.status).toBe("APPROVED");
  });

  it("9. cancel() transitions DRAFT → CANCELLED and sets deletedAt", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "DRAFT",
      version: 0,
    });
    mockTx.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValueOnce({
      ...mockInvoice,
      status: "CANCELLED",
      version: 1,
      cancelledAt: new Date(),
      deletedAt: new Date(),
    });

    const res = await service.cancel(
      "inv-123",
      { version: 0 },
      { sub: "usr-1", role: "ACCOUNTS" },
    );

    expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-123", version: 0, status: "DRAFT" },
      data: expect.objectContaining({
        status: "CANCELLED",
        version: { increment: 1 },
        cancelledAt: expect.any(Date),
        deletedAt: expect.any(Date),
      }),
    });
    expect(res.status).toBe("CANCELLED");
  });

  it("10. transition() throws BadRequestException on invalid transition (e.g. PAID → DRAFT)", async () => {
    mockTx.invoice.findFirst.mockResolvedValueOnce({
      ...mockInvoice,
      status: "PAID",
      version: 3,
    });

    await expect(
      service.submit("inv-123", { version: 3 }, { sub: "usr-1", role: "ACCOUNTS" }),
    ).rejects.toThrow(BadRequestException);
  });
});
