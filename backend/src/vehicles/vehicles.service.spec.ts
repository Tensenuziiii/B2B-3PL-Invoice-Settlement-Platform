import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, Vehicle } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VehiclesService } from "./vehicles.service";

describe("VehiclesService", () => {
  let service: VehiclesService;
  let vehicleFindMany: jest.Mock;
  let vehicleCount: jest.Mock;
  let vehicleFindFirst: jest.Mock;
  let vehicleCreate: jest.Mock;
  let vehicleUpdate: jest.Mock;

  const mockVehicle: Vehicle = {
    id: "veh-123",
    organizationId: "org-123",
    regNo: "MH-12-AB-1234",
    type: "Truck",
    capacityKg: 5000,
    currentOdometer: 12000,
    ownerId: "own-123",
    insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
    fitnessExpiry: new Date("2027-01-01T00:00:00.000Z"),
    pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vehicleFindMany = jest.fn().mockResolvedValue([mockVehicle]);
    vehicleCount = jest.fn().mockResolvedValue(1);
    vehicleFindFirst = jest.fn().mockResolvedValue(mockVehicle);
    vehicleCreate = jest.fn().mockResolvedValue(mockVehicle);
    vehicleUpdate = jest.fn().mockResolvedValue(mockVehicle);

    service = new VehiclesService({
      vehicle: {
        findMany: vehicleFindMany,
        count: vehicleCount,
        findFirst: vehicleFindFirst,
        create: vehicleCreate,
        update: vehicleUpdate,
      },
    } as unknown as PrismaService);
  });

  it("list() filters by active=true when query.active === 'true'", async () => {
    const result = await service.list({ active: "true" });

    expect(vehicleFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        owner: {
          select: { id: true, name: true, pan: true, partyType: true },
        },
      },
    });
    expect(vehicleCount).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
    });
    expect(result.data).toEqual([mockVehicle]);
    expect(result.meta).toEqual({ total: 1, limit: 50, offset: 0 });
  });

  it("list() filters by regNo search (case-insensitive)", async () => {
    await service.list({ search: "mh-12" });

    expect(vehicleFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        regNo: { contains: "mh-12", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
      include: {
        owner: {
          select: { id: true, name: true, pan: true, partyType: true },
        },
      },
    });
  });

  it("create() uppercases regNo and sets expiry dates & ownerId", async () => {
    await service.create({
      regNo: "dl-01-xy-9999",
      type: "Van",
      capacityKg: 1200,
      currentOdometer: 500,
      ownerId: "own-123",
      insuranceExpiry: "2027-01-01T00:00:00.000Z",
      fitnessExpiry: "2027-01-01T00:00:00.000Z",
      pucExpiry: "2027-01-01T00:00:00.000Z",
    });

    expect(vehicleCreate).toHaveBeenCalledWith({
      data: {
        regNo: "DL-01-XY-9999",
        type: "Van",
        capacityKg: 1200,
        currentOdometer: 500,
        ownerId: "own-123",
        insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
        fitnessExpiry: new Date("2027-01-01T00:00:00.000Z"),
        pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
        active: true,
      },
    });
  });

  it("create() throws ConflictException on P2002", async () => {
    vehicleCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    await expect(
      service.create({ regNo: "MH-12-AB-1234" }),
    ).rejects.toThrow(ConflictException);
  });

  it("get() throws NotFoundException when not found", async () => {
    vehicleFindFirst.mockResolvedValue(null);

    await expect(service.get("nonexistent-id")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update() updates fields including ownerId and dates", async () => {
    await service.update("veh-123", {
      regNo: "mh-12-ab-9999",
      insuranceExpiry: "2027-06-01T00:00:00.000Z",
    });

    expect(vehicleUpdate).toHaveBeenCalledWith({
      where: { id: "veh-123" },
      data: {
        regNo: "MH-12-AB-9999",
        insuranceExpiry: new Date("2027-06-01T00:00:00.000Z"),
      },
    });
  });

  it("deactivate() marks active=false and sets deletedAt", async () => {
    const result = await service.deactivate("veh-123");

    expect(vehicleUpdate).toHaveBeenCalledWith({
      where: { id: "veh-123" },
      data: { active: false, deletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });
});
