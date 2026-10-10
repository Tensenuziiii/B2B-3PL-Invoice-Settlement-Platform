import { InvoiceNumberService } from "./invoice-number.service";

describe("InvoiceNumberService", () => {
  let service: InvoiceNumberService;
  let mockTx: any;

  beforeEach(() => {
    service = new InvoiceNumberService();
    mockTx = {
      counter: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
  });

  it("1. nextInvoiceNumber() generates INV-YYYYMM-0001 on first call", async () => {
    const fixedDate = new Date(Date.UTC(2026, 9, 10)); // October 2026 -> 202610
    mockTx.counter.findFirst.mockResolvedValueOnce(null);
    mockTx.counter.create.mockResolvedValueOnce({
      id: "cnt-1",
      organizationId: "org-1",
      entityType: "INVOICE",
      period: "202610",
      lastValue: 1,
    });

    const result = await service.nextInvoiceNumber(mockTx, "org-1", fixedDate);

    expect(result).toBe("INV-202610-0001");
    expect(mockTx.counter.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", entityType: "INVOICE", period: "202610" },
    });
    expect(mockTx.counter.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        entityType: "INVOICE",
        period: "202610",
        lastValue: 1,
      },
    });
  });

  it("2. nextInvoiceNumber() increments to INV-YYYYMM-0002 on second call", async () => {
    const fixedDate = new Date(Date.UTC(2026, 9, 10)); // October 2026 -> 202610
    mockTx.counter.findFirst.mockResolvedValueOnce({
      id: "cnt-1",
      organizationId: "org-1",
      entityType: "INVOICE",
      period: "202610",
      lastValue: 1,
    });
    mockTx.counter.update.mockResolvedValueOnce({
      id: "cnt-1",
      organizationId: "org-1",
      entityType: "INVOICE",
      period: "202610",
      lastValue: 2,
    });

    const result = await service.nextInvoiceNumber(mockTx, "org-1", fixedDate);

    expect(result).toBe("INV-202610-0002");
    expect(mockTx.counter.update).toHaveBeenCalledWith({
      where: { id: "cnt-1" },
      data: { lastValue: { increment: 1 } },
    });
  });

  it("3. nextInvoiceNumber() throws non-P2002 Prisma errors", async () => {
    const fixedDate = new Date(Date.UTC(2026, 9, 10));
    mockTx.counter.findFirst.mockResolvedValueOnce(null);
    const dbError = new Error("Database connection lost");
    mockTx.counter.create.mockRejectedValueOnce(dbError);

    await expect(
      service.nextInvoiceNumber(mockTx, "org-1", fixedDate),
    ).rejects.toThrow("Database connection lost");
  });
});
