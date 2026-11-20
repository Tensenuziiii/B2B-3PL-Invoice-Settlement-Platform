import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, Vendor } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VendorsService } from "./vendors.service";

describe("VendorsService", () => {
  let service: VendorsService;
  let vendorFindMany: jest.Mock;
  let vendorCount: jest.Mock;
  let vendorFindFirst: jest.Mock;
  let vendorCreate: jest.Mock;
  let vendorUpdate: jest.Mock;

  const mockVendor: Vendor = {
    id: "vnd-123",
    organizationId: "org-123",
    name: "Acme 3PL",
    code: "ACME-01",
    gstin: "27AABCU9603R1ZN",
    stateCode: "27",
    payoutTermsDays: 15,
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vendorFindMany = jest.fn().mockResolvedValue([mockVendor]);
    vendorCount = jest.fn().mockResolvedValue(1);
    vendorFindFirst = jest.fn().mockResolvedValue(mockVendor);
    vendorCreate = jest.fn().mockResolvedValue(mockVendor);
    vendorUpdate = jest.fn().mockResolvedValue(mockVendor);

    service = new VendorsService({
      vendor: {
        findMany: vendorFindMany,
        count: vendorCount,
        findFirst: vendorFindFirst,
        create: vendorCreate,
        update: vendorUpdate,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by status", async () => {
    const result = await service.list({ status: "ACTIVE" });

    expect(vendorFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
    expect(vendorCount).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    expect(result.data).toEqual([mockVendor]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() searches name OR code", async () => {
    await service.list({ search: "acme" });

    expect(vendorFindMany).toHaveBeenCalledWith({
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
      name: "Acme 3PL",
      code: "acme-01",
    });

    expect(vendorCreate).toHaveBeenCalledWith({
      data: {
        name: "Acme 3PL",
        code: "ACME-01",
        gstin: null,
        stateCode: null,
        payoutTermsDays: 15,
        status: "ACTIVE",
      },
    });
  });

  it("create() defaults payoutTermsDays to 15", async () => {
    await service.create({
      name: "Beta Logistics",
      code: "BETA-02",
    });

    expect(vendorCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payoutTermsDays: 15,
      }),
    });
  });

  it("create() throws ConflictException on P2002", async () => {
    vendorCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({ name: "Acme 3PL", code: "ACME-01" }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException", async () => {
    vendorFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deactivate() sets status INACTIVE and deletedAt", async () => {
    const result = await service.deactivate("vnd-123");

    expect(vendorUpdate).toHaveBeenCalledWith({
      where: { id: "vnd-123" },
      data: { status: "INACTIVE", deletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });
});
