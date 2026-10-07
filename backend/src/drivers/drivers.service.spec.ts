import { ConflictException, NotFoundException } from "@nestjs/common";
import { Driver, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DriversService } from "./drivers.service";

describe("DriversService", () => {
  let service: DriversService;
  let driverFindMany: jest.Mock;
  let driverCount: jest.Mock;
  let driverFindFirst: jest.Mock;
  let driverCreate: jest.Mock;
  let driverUpdate: jest.Mock;

  const mockDriver: Driver = {
    id: "drv-123",
    organizationId: "org-123",
    name: "John Doe",
    phone: "+919876543210",
    licenseNo: "DL-1234567890123",
    licenseExpiry: new Date("2030-01-01T00:00:00.000Z"),
    userId: null,
    dutyStatus: "OFFLINE",
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    driverFindMany = jest.fn().mockResolvedValue([mockDriver]);
    driverCount = jest.fn().mockResolvedValue(1);
    driverFindFirst = jest.fn().mockImplementation(async (args) => {
      if (args?.where?.id) return mockDriver;
      return null;
    });
    driverCreate = jest.fn().mockResolvedValue(mockDriver);
    driverUpdate = jest.fn().mockResolvedValue(mockDriver);

    service = new DriversService({
      driver: {
        findMany: driverFindMany,
        count: driverCount,
        findFirst: driverFindFirst,
        create: driverCreate,
        update: driverUpdate,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by active=true when query.active === 'true'", async () => {
    const result = await service.list({ active: "true" });

    expect(driverFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
    expect(driverCount).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
    });
    expect(result.data).toEqual([mockDriver]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() searches name AND phone", async () => {
    await service.list({ search: "john" });

    expect(driverFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: "john", mode: "insensitive" } },
          { phone: { contains: "john" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
  });

  it("create() parses licenseExpiry string to Date", async () => {
    await service.create({
      name: "John Doe",
      phone: "+919876543210",
      licenseNo: "DL-12345",
      licenseExpiry: "2030-01-01T00:00:00.000Z",
    });

    expect(driverCreate).toHaveBeenCalledWith({
      data: {
        name: "John Doe",
        phone: "+919876543210",
        licenseNo: "DL-12345",
        licenseExpiry: new Date("2030-01-01T00:00:00.000Z"),
        userId: null,
        active: true,
      },
    });
  });

  it("create() throws ConflictException on P2002", async () => {
    driverCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({ name: "John Doe", phone: "+919876543210" }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException when not found", async () => {
    driverFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update() throws NotFoundException when not found", async () => {
    driverFindFirst.mockResolvedValue(null);

    await expect(
      service.update("nonexistent-id", { name: "Jane Doe" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("deactivate() sets active=false and deletedAt", async () => {
    const result = await service.deactivate("drv-123");

    expect(driverFindFirst).toHaveBeenCalledWith({
      where: { id: "drv-123", deletedAt: null },
    });
    expect(driverUpdate).toHaveBeenCalledWith({
      where: { id: "drv-123" },
      data: { active: false, deletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });
});
