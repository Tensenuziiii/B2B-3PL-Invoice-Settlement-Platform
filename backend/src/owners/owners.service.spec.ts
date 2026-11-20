import { ConflictException, NotFoundException } from "@nestjs/common";
import { Owner, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OwnersService } from "./owners.service";

describe("OwnersService", () => {
  let service: OwnersService;
  let ownerFindMany: jest.Mock;
  let ownerCount: jest.Mock;
  let ownerFindFirst: jest.Mock;
  let ownerCreate: jest.Mock;
  let ownerUpdate: jest.Mock;

  const mockOwner: Owner = {
    id: "own-123",
    organizationId: "org-123",
    name: "Sharma Logistics Transport",
    partyType: "FLEET_OPERATOR",
    pan: "ABCDE1234F",
    phone: "9876543210",
    address: "Bhiwandi, Maharashtra",
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    ownerFindMany = jest.fn().mockResolvedValue([mockOwner]);
    ownerCount = jest.fn().mockResolvedValue(1);
    ownerFindFirst = jest.fn().mockResolvedValue(mockOwner);
    ownerCreate = jest.fn().mockResolvedValue(mockOwner);
    ownerUpdate = jest.fn().mockResolvedValue(mockOwner);

    service = new OwnersService({
      owner: {
        findMany: ownerFindMany,
        count: ownerCount,
        findFirst: ownerFindFirst,
        create: ownerCreate,
        update: ownerUpdate,
      },
    } as unknown as PrismaService);
  });

  it("list() searches by name, pan, or phone", async () => {
    const result = await service.list({ search: "sharma" });

    expect(ownerFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: "sharma", mode: "insensitive" } },
          { pan: { contains: "sharma", mode: "insensitive" } },
          { phone: { contains: "sharma" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        _count: {
          select: { trucks: true, trips: true },
        },
      },
    });
    expect(result.data).toEqual([mockOwner]);
  });

  it("create() uppercases PAN and defaults partyType to INDIVIDUAL", async () => {
    await service.create({
      name: "Ramesh Kumar",
      pan: "abcde1234f",
    });

    expect(ownerCreate).toHaveBeenCalledWith({
      data: {
        name: "Ramesh Kumar",
        partyType: "INDIVIDUAL",
        pan: "ABCDE1234F",
        phone: null,
        address: null,
        active: true,
      },
    });
  });

  it("create() throws ConflictException on duplicate name P2002", async () => {
    ownerCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({ name: "Sharma Logistics Transport" }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException when not found", async () => {
    ownerFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deactivate() marks active false and sets deletedAt", async () => {
    await service.deactivate("own-123");

    expect(ownerUpdate).toHaveBeenCalledWith({
      where: { id: "own-123" },
      data: { active: false, deletedAt: expect.any(Date) },
    });
  });
});
