import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { DisputeNumberService } from "./dispute-number.service";
import { PrismaService } from "../prisma/prisma.service";
import { tenantStorage } from "../core/tenant/tenant.context";

describe("DisputesService", () => {
  let service: DisputesService;
  let mockPrisma: any;
  let mockDisputeNumbers: { nextDisputeNumber: jest.Mock };
  let mockTx: any;

  beforeEach(() => {
    tenantStorage.enterWith({ organizationId: "org-123", userId: "usr-123" });

    mockTx = {
      invoiceLine: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      invoice: {
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      dispute: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    mockDisputeNumbers = {
      nextDisputeNumber: jest.fn().mockResolvedValue("DSP-202610-0001"),
    };

    mockPrisma = {
      dispute: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    };

    service = new DisputesService(
      mockPrisma as unknown as PrismaService,
      mockDisputeNumbers as unknown as DisputeNumberService,
    );
  });

  it("1. create() throws when invoice line not found", async () => {
    mockTx.invoiceLine.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          invoiceLineId: "line-999",
          reasonCode: "QTY_MISMATCH",
          comment: "Missing 2 items",
          amountPaise: 5000,
        },
        "usr-123",
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("2. create() throws when invoice is DRAFT", async () => {
    mockTx.invoiceLine.findFirst.mockResolvedValue({
      id: "line-1",
      totalAmount: 10000,
      invoice: { id: "inv-1", status: "DRAFT" },
    });

    await expect(
      service.create(
        {
          invoiceLineId: "line-1",
          reasonCode: "RATE_DISCREPANCY",
          comment: "Rate too high",
          amountPaise: 5000,
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("3. create() throws when an existing dispute exists for the line", async () => {
    mockTx.invoiceLine.findFirst.mockResolvedValue({
      id: "line-1",
      totalAmount: 10000,
      invoice: { id: "inv-1", status: "CLIENT_REVIEW" },
    });
    mockTx.dispute.findFirst.mockResolvedValue({ id: "dsp-old", invoiceLineId: "line-1" });

    await expect(
      service.create(
        {
          invoiceLineId: "line-1",
          reasonCode: "DAMAGE",
          comment: "Goods damaged",
          amountPaise: 5000,
        },
        "usr-123",
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("4. create() throws when amountPaise > line.totalAmount", async () => {
    mockTx.invoiceLine.findFirst.mockResolvedValue({
      id: "line-1",
      totalAmount: 10000,
      invoice: { id: "inv-1", status: "CLIENT_REVIEW" },
    });
    mockTx.dispute.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          invoiceLineId: "line-1",
          reasonCode: "DAMAGE",
          comment: "Damaged box",
          amountPaise: 15000,
        },
        "usr-123",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("5. create() auto-transitions invoice to DISPUTED if CLIENT_REVIEW", async () => {
    mockTx.invoiceLine.findFirst.mockResolvedValue({
      id: "line-1",
      invoiceId: "inv-1",
      totalAmount: 20000,
      invoice: { id: "inv-1", status: "CLIENT_REVIEW" },
    });
    mockTx.dispute.findFirst.mockResolvedValue(null);
    mockTx.dispute.create.mockResolvedValue({
      id: "dsp-1",
      disputeNumber: "DSP-202610-0001",
      status: "DISPUTED",
    });

    const result = await service.create(
      {
        invoiceLineId: "line-1",
        reasonCode: "DAMAGE",
        comment: "Broken goods",
        amountPaise: 10000,
      },
      "usr-123",
    );

    expect(result.id).toBe("dsp-1");
    expect(mockTx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", status: "CLIENT_REVIEW" },
      data: { status: "DISPUTED", version: { increment: 1 } },
    });
  });

  it("6. updateStatus() throws ConflictException on stale version", async () => {
    mockTx.dispute.findFirst.mockResolvedValue({
      id: "dsp-1",
      version: 2,
      status: "DISPUTED",
    });

    await expect(
      service.updateStatus("dsp-1", { version: 1, status: "UNDER_REVIEW" }, "usr-123"),
    ).rejects.toThrow(ConflictException);
  });

  it("7. updateStatus() throws when dispute status is not DISPUTED", async () => {
    mockTx.dispute.findFirst.mockResolvedValue({
      id: "dsp-1",
      version: 0,
      status: "UNDER_REVIEW",
    });

    await expect(
      service.updateStatus("dsp-1", { version: 0, status: "UNDER_REVIEW" }, "usr-123"),
    ).rejects.toThrow(BadRequestException);
  });

  it("8. resolve() adjusts invoice line on ACCEPTED", async () => {
    mockTx.dispute.findFirst.mockResolvedValue({
      id: "dsp-1",
      invoiceLineId: "line-1",
      amountPaise: 20000,
      version: 0,
      status: "UNDER_REVIEW",
    });
    mockTx.dispute.updateMany.mockResolvedValue({ count: 1 });
    mockTx.dispute.findUniqueOrThrow.mockResolvedValue({
      id: "dsp-1",
      status: "RESOLVED",
      resolution: "ACCEPTED",
    });

    mockTx.invoiceLine.findUnique.mockResolvedValue({
      id: "line-1",
      invoiceId: "inv-1",
      lineAmount: 50000,
      gstAmount: 9000,
      totalAmount: 59000,
    });
    mockTx.invoiceLine.update.mockResolvedValue({});
    mockTx.invoiceLine.findMany.mockResolvedValue([
      { lineAmount: 30000, gstAmount: 5400 },
    ]);
    mockTx.invoice.update.mockResolvedValue({});

    const result = await service.resolve(
      "dsp-1",
      {
        version: 0,
        resolution: "ACCEPTED",
        resolutionNotes: "Agreed to deduction",
      },
      "usr-123",
    );

    expect(result.status).toBe("RESOLVED");
    expect(mockTx.invoiceLine.update).toHaveBeenCalledWith({
      where: { id: "line-1" },
      data: {
        lineAmount: 30000,
        gstAmount: 5400,
        totalAmount: 35400,
      },
    });
    expect(mockTx.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: {
        subtotal: 30000,
        gstAmount: 5400,
        total: 35400,
      },
    });
  });

  it("9. postMessage() throws when dispute is RESOLVED", async () => {
    mockPrisma.dispute.findFirst.mockResolvedValue({
      id: "dsp-1",
      status: "RESOLVED",
    });

    await expect(
      service.postMessage("dsp-1", { body: "Can we review this?" }, "usr-123"),
    ).rejects.toThrow(BadRequestException);
  });

  it("10. list() filters by status", async () => {
    mockPrisma.dispute.findMany.mockResolvedValue([
      { id: "dsp-1", status: "DISPUTED" },
    ]);
    mockPrisma.dispute.count.mockResolvedValue(1);

    const result = await service.list({ status: "DISPUTED" });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DISPUTED" }),
      }),
    );
  });
});
