import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, Route } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RoutesService } from "./routes.service";

describe("RoutesService", () => {
  let service: RoutesService;
  let routeFindMany: jest.Mock;
  let routeCount: jest.Mock;
  let routeFindFirst: jest.Mock;
  let routeCreate: jest.Mock;
  let routeUpdate: jest.Mock;

  const mockRoute: Route = {
    id: "rte-123",
    organizationId: "org-123",
    name: "Mumbai to Pune",
    origin: "Mumbai",
    destination: "Pune",
    expectedKm: 150,
    standardTollEstimate: 350,
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    routeFindMany = jest.fn().mockResolvedValue([mockRoute]);
    routeCount = jest.fn().mockResolvedValue(1);
    routeFindFirst = jest.fn().mockResolvedValue(mockRoute);
    routeCreate = jest.fn().mockResolvedValue(mockRoute);
    routeUpdate = jest.fn().mockResolvedValue(mockRoute);

    service = new RoutesService({
      route: {
        findMany: routeFindMany,
        count: routeCount,
        findFirst: routeFindFirst,
        create: routeCreate,
        update: routeUpdate,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by status", async () => {
    const result = await service.list({ status: "ACTIVE" });

    expect(routeFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
    expect(routeCount).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    expect(result.data).toEqual([mockRoute]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() searches name, origin, AND destination", async () => {
    await service.list({ search: "mumbai" });

    expect(routeFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: "mumbai", mode: "insensitive" } },
          { origin: { contains: "mumbai", mode: "insensitive" } },
          { destination: { contains: "mumbai", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
  });

  it("create() defaults standardTollEstimate to 0 when omitted", async () => {
    await service.create({
      name: "Delhi to Agra",
      origin: "Delhi",
      destination: "Agra",
      expectedKm: 230,
    });

    expect(routeCreate).toHaveBeenCalledWith({
      data: {
        name: "Delhi to Agra",
        origin: "Delhi",
        destination: "Agra",
        expectedKm: 230,
        standardTollEstimate: 0,
        status: "ACTIVE",
      },
    });
  });

  it("create() trims whitespace from name/origin/destination", async () => {
    await service.create({
      name: "  Delhi to Jaipur  ",
      origin: "  Delhi  ",
      destination: "  Jaipur  ",
      expectedKm: 280,
      standardTollEstimate: 500,
    });

    expect(routeCreate).toHaveBeenCalledWith({
      data: {
        name: "Delhi to Jaipur",
        origin: "Delhi",
        destination: "Jaipur",
        expectedKm: 280,
        standardTollEstimate: 500,
        status: "ACTIVE",
      },
    });
  });

  it("create() throws ConflictException on P2002", async () => {
    routeCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({
        name: "Mumbai to Pune",
        origin: "Mumbai",
        destination: "Pune",
        expectedKm: 150,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException", async () => {
    routeFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deactivate() sets status INACTIVE and deletedAt", async () => {
    const result = await service.deactivate("rte-123");

    expect(routeUpdate).toHaveBeenCalledWith({
      where: { id: "rte-123" },
      data: { status: "INACTIVE", deletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });
});
