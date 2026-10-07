import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Client, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClientsService } from "./clients.service";

describe("ClientsService", () => {
  let service: ClientsService;
  let clientFindMany: jest.Mock;
  let clientCount: jest.Mock;
  let clientFindFirst: jest.Mock;
  let clientCreate: jest.Mock;
  let clientUpdate: jest.Mock;

  const mockClient: Client = {
    id: "clt-123",
    organizationId: "org-123",
    name: "Acme Logistics",
    code: "ACME-01",
    gstin: "27AABCU9603R1ZN",
    stateCode: "27",
    paymentTermsDays: 30,
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    clientFindMany = jest.fn().mockResolvedValue([mockClient]);
    clientCount = jest.fn().mockResolvedValue(1);
    clientFindFirst = jest.fn().mockResolvedValue(mockClient);
    clientCreate = jest.fn().mockResolvedValue(mockClient);
    clientUpdate = jest.fn().mockResolvedValue(mockClient);

    service = new ClientsService({
      client: {
        findMany: clientFindMany,
        count: clientCount,
        findFirst: clientFindFirst,
        create: clientCreate,
        update: clientUpdate,
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
    });
  });

  it("create() uppercases code", async () => {
    await service.create({
      name: "Acme Logistics",
      code: "acme-01",
    });

    expect(clientCreate).toHaveBeenCalledWith({
      data: {
        name: "Acme Logistics",
        code: "ACME-01",
        gstin: null,
        stateCode: null,
        paymentTermsDays: 30,
        status: "ACTIVE",
      },
    });
  });

  it("create() defaults paymentTermsDays to 30", async () => {
    await service.create({
      name: "Beta Corp",
      code: "BETA-02",
    });

    expect(clientCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentTermsDays: 30,
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
});
