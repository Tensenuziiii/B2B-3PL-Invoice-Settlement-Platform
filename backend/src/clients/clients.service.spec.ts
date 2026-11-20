import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Client, CustomerContact, ApprovalStageTemplate, CustomerDocumentRule, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClientsService } from "./clients.service";

describe("ClientsService", () => {
  let service: ClientsService;
  let clientFindMany: jest.Mock;
  let clientCount: jest.Mock;
  let clientFindFirst: jest.Mock;
  let clientCreate: jest.Mock;
  let clientUpdate: jest.Mock;

  let customerContactFindMany: jest.Mock;
  let customerContactFindFirst: jest.Mock;
  let customerContactCreate: jest.Mock;
  let customerContactUpdate: jest.Mock;
  let customerContactUpdateMany: jest.Mock;
  let customerContactDelete: jest.Mock;

  let approvalStageTemplateFindMany: jest.Mock;
  let approvalStageTemplateFindFirst: jest.Mock;
  let approvalStageTemplateCreate: jest.Mock;
  let approvalStageTemplateUpdate: jest.Mock;
  let approvalStageTemplateDelete: jest.Mock;

  let customerDocumentRuleFindMany: jest.Mock;
  let customerDocumentRuleFindFirst: jest.Mock;
  let customerDocumentRuleCreate: jest.Mock;
  let customerDocumentRuleUpdate: jest.Mock;
  let customerDocumentRuleDelete: jest.Mock;

  const mockClient: Client = {
    id: "clt-123",
    organizationId: "org-123",
    name: "Acme Logistics",
    code: "ACME-01",
    gstin: "27AABCU9603R1ZN",
    stateCode: "27",
    paymentTermsDays: 30,
    creditDays: 30,
    digitalPodEnabled: false,
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const mockContact: CustomerContact = {
    id: "ct-123",
    organizationId: "org-123",
    clientId: "clt-123",
    name: "John Doe",
    role: "LOGISTICS_HEAD",
    phone: "9876543210",
    email: "john@acme.com",
    isPrimary: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };

  const mockApprovalTemplate: ApprovalStageTemplate = {
    id: "ast-123",
    organizationId: "org-123",
    clientId: "clt-123",
    sequence: 1,
    name: "POD Soft Copy Check",
    slaHours: 48,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };

  const mockDocumentRule: CustomerDocumentRule = {
    id: "cdr-123",
    organizationId: "org-123",
    clientId: "clt-123",
    documentType: "ORIGINAL_LR",
    isMandatory: true,
    notes: "Must be stamped",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    clientFindMany = jest.fn().mockResolvedValue([mockClient]);
    clientCount = jest.fn().mockResolvedValue(1);
    clientFindFirst = jest.fn().mockResolvedValue(mockClient);
    clientCreate = jest.fn().mockResolvedValue(mockClient);
    clientUpdate = jest.fn().mockResolvedValue(mockClient);

    customerContactFindMany = jest.fn().mockResolvedValue([mockContact]);
    customerContactFindFirst = jest.fn().mockResolvedValue(mockContact);
    customerContactCreate = jest.fn().mockResolvedValue(mockContact);
    customerContactUpdate = jest.fn().mockResolvedValue(mockContact);
    customerContactUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    customerContactDelete = jest.fn().mockResolvedValue(mockContact);

    approvalStageTemplateFindMany = jest.fn().mockResolvedValue([mockApprovalTemplate]);
    approvalStageTemplateFindFirst = jest.fn().mockResolvedValue(mockApprovalTemplate);
    approvalStageTemplateCreate = jest.fn().mockResolvedValue(mockApprovalTemplate);
    approvalStageTemplateUpdate = jest.fn().mockResolvedValue(mockApprovalTemplate);
    approvalStageTemplateDelete = jest.fn().mockResolvedValue(mockApprovalTemplate);

    customerDocumentRuleFindMany = jest.fn().mockResolvedValue([mockDocumentRule]);
    customerDocumentRuleFindFirst = jest.fn().mockResolvedValue(mockDocumentRule);
    customerDocumentRuleCreate = jest.fn().mockResolvedValue(mockDocumentRule);
    customerDocumentRuleUpdate = jest.fn().mockResolvedValue(mockDocumentRule);
    customerDocumentRuleDelete = jest.fn().mockResolvedValue(mockDocumentRule);

    service = new ClientsService({
      client: {
        findMany: clientFindMany,
        count: clientCount,
        findFirst: clientFindFirst,
        create: clientCreate,
        update: clientUpdate,
      },
      customerContact: {
        findMany: customerContactFindMany,
        findFirst: customerContactFindFirst,
        create: customerContactCreate,
        update: customerContactUpdate,
        updateMany: customerContactUpdateMany,
        delete: customerContactDelete,
      },
      approvalStageTemplate: {
        findMany: approvalStageTemplateFindMany,
        findFirst: approvalStageTemplateFindFirst,
        create: approvalStageTemplateCreate,
        update: approvalStageTemplateUpdate,
        delete: approvalStageTemplateDelete,
      },
      customerDocumentRule: {
        findMany: customerDocumentRuleFindMany,
        findFirst: customerDocumentRuleFindFirst,
        create: customerDocumentRuleCreate,
        update: customerDocumentRuleUpdate,
        delete: customerDocumentRuleDelete,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by status when provided", async () => {
    const result = await service.list({ status: "ACTIVE" });

    expect(clientFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        contacts: true,
        approvalTemplates: { orderBy: { sequence: "asc" } },
        documentRules: true,
      },
    });
    expect(clientCount).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    expect(result.data).toEqual([mockClient]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() searches by name OR code", async () => {
    await service.list({ search: "acme" });

    expect(clientFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: "acme", mode: "insensitive" } },
          { code: { contains: "acme", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        contacts: true,
        approvalTemplates: { orderBy: { sequence: "asc" } },
        documentRules: true,
      },
    });
  });

  it("create() uppercases code and handles creditDays & digitalPodEnabled", async () => {
    await service.create({
      name: "Acme Logistics",
      code: "acme-01",
      creditDays: 45,
      digitalPodEnabled: true,
    });

    expect(clientCreate).toHaveBeenCalledWith({
      data: {
        name: "Acme Logistics",
        code: "ACME-01",
        gstin: null,
        stateCode: null,
        paymentTermsDays: 45,
        creditDays: 45,
        digitalPodEnabled: true,
        status: "ACTIVE",
      },
    });
  });

  it("create() defaults paymentTermsDays and creditDays to 30", async () => {
    await service.create({
      name: "Beta Corp",
      code: "BETA-02",
    });

    expect(clientCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentTermsDays: 30,
        creditDays: 30,
        digitalPodEnabled: false,
      }),
    });
  });

  it("create() throws ConflictException on P2002", async () => {
    clientCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({ name: "Acme Logistics", code: "ACME-01" }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException when not found", async () => {
    clientFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update() rejects invalid status via DTO — verify service accepts valid status", async () => {
    await expect(
      service.update("clt-123", { status: "INVALID_STATUS" as any }),
    ).rejects.toThrow(BadRequestException);

    const updated = await service.update("clt-123", { status: "SUSPENDED" });
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: "clt-123" },
      data: { status: "SUSPENDED" },
    });
    expect(updated).toEqual(mockClient);
  });

  // Customer Contact tests
  it("createContact() clears existing primary if new contact isPrimary", async () => {
    const contact = await service.createContact("clt-123", {
      name: "Jane Doe",
      isPrimary: true,
    });

    expect(customerContactUpdateMany).toHaveBeenCalledWith({
      where: { clientId: "clt-123", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(customerContactCreate).toHaveBeenCalled();
    expect(contact).toEqual(mockContact);
  });

  // Approval Stage Template tests
  it("createApprovalTemplate() creates template stage with sequence", async () => {
    const template = await service.createApprovalTemplate("clt-123", {
      sequence: 1,
      name: "POD Soft Copy Check",
      slaHours: 48,
    });

    expect(approvalStageTemplateCreate).toHaveBeenCalledWith({
      data: {
        clientId: "clt-123",
        sequence: 1,
        name: "POD Soft Copy Check",
        slaHours: 48,
      },
    });
    expect(template).toEqual(mockApprovalTemplate);
  });

  it("createApprovalTemplate() throws ConflictException on duplicate sequence", async () => {
    approvalStageTemplateCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.createApprovalTemplate("clt-123", {
        sequence: 1,
        name: "Duplicate Stage",
      }),
    ).rejects.toThrow(ConflictException);
  });

  // Document Rule tests
  it("createDocumentRule() creates document rule with uppercase documentType", async () => {
    const rule = await service.createDocumentRule("clt-123", {
      documentType: "original_lr",
      isMandatory: true,
      notes: "Must be stamped",
    });

    expect(customerDocumentRuleCreate).toHaveBeenCalledWith({
      data: {
        clientId: "clt-123",
        documentType: "ORIGINAL_LR",
        isMandatory: true,
        notes: "Must be stamped",
      },
    });
    expect(rule).toEqual(mockDocumentRule);
  });
});
