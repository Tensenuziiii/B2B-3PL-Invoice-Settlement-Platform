import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { InvoiceNumberService } from "../billing/invoice-number.service";
import * as tenantContext from "../core/tenant/tenant.context";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let mockInvoiceFindMany: jest.Mock;
  let mockInvoiceCount: jest.Mock;
  let mockInvoiceFindFirst: jest.Mock;
  let mockPodFindFirst: jest.Mock;
  let mockApprovalStageTemplateFindMany: jest.Mock;
  let mockInvoiceNumberService: any;
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
    jest.spyOn(tenantContext, "requireTenant").mockReturnValue({ organizationId: "org-123", userId: "usr-123" });

    mockInvoiceFindMany = jest.fn();
    mockInvoiceCount = jest.fn();
    mockInvoiceFindFirst = jest.fn();
    mockPodFindFirst = jest.fn();
    mockApprovalStageTemplateFindMany = jest.fn();

    mockInvoiceNumberService = {
      nextInvoiceNumber: jest.fn().mockResolvedValue("INV-202610-0001"),
    };

    mockTx = {
      invoice: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue(mockInvoice),
        update: jest.fn().mockResolvedValue(mockInvoice),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockInvoice),
      },
      pod: {
        update: jest.fn().mockResolvedValue({ id: "pod-123" }),
      },
      invoiceLine: {
        create: jest.fn().mockResolvedValue({ id: "line-123" }),
      },
      invoiceStage: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockPrismaService = {
      invoice: {
        findMany: mockInvoiceFindMany,
        count: mockInvoiceCount,
        findFirst: mockInvoiceFindFirst,
      },
      pod: {
        findFirst: mockPodFindFirst,
      },
      approvalStageTemplate: {
        findMany: mockApprovalStageTemplateFindMany,
      },
      invoiceStage: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoiceFollowUp: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: "fup-1", ...args.data })),
      },
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };

    service = new InvoicesService(
      mockPrismaService as unknown as PrismaService,
      mockInvoiceNumberService as unknown as InvoiceNumberService,
    );
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

  describe("generateFromPod()", () => {
    const validPod = {
      id: "pod-123",
      organizationId: "org-123",
      currentStatus: "ORIGINAL_RECEIVED",
      invoiceId: null,
      tripId: "trip-123",
      trip: {
        id: "trip-123",
        tripNumber: "TRP-001",
        origin: "Origin",
        destination: "Dest",
        lrNumber: "LR-001",
        deliveredAt: new Date("2026-10-10"),
        clientId: "cli-123",
        client: {
          id: "cli-123",
          creditDays: 30,
        },
      },
    };

    it("11. successfully generates invoice, copies customer approval stages, and computes GST", async () => {
      mockPodFindFirst.mockResolvedValueOnce(validPod);
      mockInvoiceFindFirst.mockResolvedValueOnce(null); // No existing invoice
      mockApprovalStageTemplateFindMany.mockResolvedValueOnce([
        { sequence: 1, name: "Gate In Check" },
        { sequence: 2, name: "Finance Approval" },
      ]);

      const res = await service.generateFromPod(
        { podId: "pod-123", subtotal: 100000, gstRate: 18 },
        "usr-1",
      );

      expect(mockTx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientId: "cli-123",
            podId: "pod-123",
            subtotal: 100000,
            gstRate: 18,
            gstAmount: 18000,
            total: 118000,
          }),
        }),
      );

      expect(mockTx.invoiceStage.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ sequence: 1, name: "Gate In Check", status: "ACTIVE" }),
          expect.objectContaining({ sequence: 2, name: "Finance Approval", status: "PENDING" }),
        ],
      });

      expect(mockTx.pod.update).toHaveBeenCalledWith({
        where: { id: "pod-123" },
        data: { invoiceId: "inv-123" },
      });

      expect(res).toBeDefined();
    });

    it("12. rejects unverified or on-hold POD with BadRequestException", async () => {
      mockPodFindFirst.mockResolvedValueOnce({
        ...validPod,
        currentStatus: "ON_HOLD",
      });

      await expect(
        service.generateFromPod({ podId: "pod-123" }, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("13. rejects when POD already has linked invoice with ConflictException", async () => {
      mockPodFindFirst.mockResolvedValueOnce({
        ...validPod,
        invoiceId: "inv-already-exists",
      });

      await expect(
        service.generateFromPod({ podId: "pod-123" }, "usr-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("14. falls back to default stages if client has no stage templates", async () => {
      mockPodFindFirst.mockResolvedValueOnce(validPod);
      mockInvoiceFindFirst.mockResolvedValueOnce(null);
      mockApprovalStageTemplateFindMany.mockResolvedValueOnce([]); // No templates

      await service.generateFromPod({ podId: "pod-123", subtotal: 50000 }, "usr-1");

      expect(mockTx.invoiceStage.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ sequence: 1, name: "POD Verification", status: "ACTIVE" }),
          expect.objectContaining({ sequence: 2, name: "Commercial Approval", status: "PENDING" }),
          expect.objectContaining({ sequence: 3, name: "Finance Authorization", status: "PENDING" }),
        ],
      });
    });
  });

  describe("Invoice stages & follow-ups (R1-TASK-6.2)", () => {
    const stage1 = {
      id: "stg-1",
      invoiceId: "inv-123",
      sequence: 1,
      name: "Commercial Verification",
      status: "ACTIVE",
      remarks: null,
    };
    const stage2 = {
      id: "stg-2",
      invoiceId: "inv-123",
      sequence: 2,
      name: "Finance Sign-off",
      status: "PENDING",
      remarks: null,
    };

    it("15. approveStage() advances stage and activates next stage in sequence", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce(mockInvoice);
      mockPrismaService.invoiceStage.findFirst.mockResolvedValueOnce(stage1);
      mockTx.invoiceStage.findFirst.mockResolvedValueOnce(stage2);

      await service.approveStage("inv-123", "stg-1", { remarks: "Approved" }, "usr-1");

      expect(mockTx.invoiceStage.update).toHaveBeenCalledWith({
        where: { id: "stg-1" },
        data: expect.objectContaining({
          status: "APPROVED",
          approvedById: "usr-1",
          remarks: "Approved",
        }),
      });

      expect(mockTx.invoiceStage.update).toHaveBeenCalledWith({
        where: { id: "stg-2" },
        data: { status: "ACTIVE" },
      });

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IN_STAGE" }),
        }),
      );
    });

    it("16. approveStage() transitions invoice to FULLY_APPROVED when final stage is approved", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce(mockInvoice);
      mockPrismaService.invoiceStage.findFirst.mockResolvedValueOnce(stage2);
      mockTx.invoiceStage.findFirst.mockResolvedValueOnce(null); // No subsequent stage

      await service.approveStage("inv-123", "stg-2", {}, "usr-1");

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FULLY_APPROVED" }),
        }),
      );
    });

    it("17. approveStage() rejects if stage is already approved or on hold", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce(mockInvoice);
      mockPrismaService.invoiceStage.findFirst.mockResolvedValueOnce({
        ...stage1,
        status: "APPROVED",
      });

      await expect(
        service.approveStage("inv-123", "stg-1", {}, "usr-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("18. holdStage() puts stage and invoice on hold", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce(mockInvoice);
      mockPrismaService.invoiceStage.findFirst.mockResolvedValueOnce(stage1);

      await service.holdStage("inv-123", "stg-1", { reason: "Rate dispute" }, "usr-1");

      expect(mockTx.invoiceStage.update).toHaveBeenCalledWith({
        where: { id: "stg-1" },
        data: expect.objectContaining({ status: "ON_HOLD" }),
      });

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ON_HOLD" }),
        }),
      );
    });

    it("19. releaseStageHold() releases hold on stage and returns invoice to IN_STAGE", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce({ ...mockInvoice, status: "ON_HOLD" });
      mockPrismaService.invoiceStage.findFirst.mockResolvedValueOnce({
        ...stage1,
        status: "ON_HOLD",
      });

      await service.releaseStageHold("inv-123", "stg-1", {}, "usr-1");

      expect(mockTx.invoiceStage.update).toHaveBeenCalledWith({
        where: { id: "stg-1" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      });

      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IN_STAGE" }),
        }),
      );
    });

    it("20. createFollowUp() records follow up entry with outcome and next follow up date", async () => {
      mockInvoiceFindFirst.mockResolvedValueOnce(mockInvoice);

      const res = await service.createFollowUp(
        "inv-123",
        {
          outcome: "PROMISE_TO_PAY",
          contactPerson: "Mr. Sharma",
          remarks: "Promised payment next Friday",
          nextFollowUpOn: "2026-10-25T00:00:00.000Z",
        },
        "usr-1",
      );

      expect(mockPrismaService.invoiceFollowUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: "inv-123",
            outcome: "PROMISE_TO_PAY",
            contactPerson: "Mr. Sharma",
            loggedById: "usr-1",
          }),
        }),
      );
      expect(res.id).toBe("fup-1");
    });
  });
});
