import { UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AssignmentGuardService } from "./assignment-guard.service";

describe("AssignmentGuardService", () => {
  let service: AssignmentGuardService;
  let vehicleFindFirst: jest.Mock;
  let driverFindFirst: jest.Mock;

  const validVehicle = {
    id: "veh-1",
    regNo: "MH-12-AB-1234",
    insuranceExpiry: new Date("2028-01-01T00:00:00.000Z"),
    fitnessExpiry: new Date("2028-01-01T00:00:00.000Z"),
    pucExpiry: new Date("2028-01-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const expiredVehicle = {
    id: "veh-expired",
    regNo: "MH-12-EX-9999",
    insuranceExpiry: new Date("2025-01-01T00:00:00.000Z"), // expired relative to 2026
    fitnessExpiry: new Date("2028-01-01T00:00:00.000Z"),
    pucExpiry: new Date("2028-01-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const validDriver = {
    id: "drv-1",
    name: "John Driver",
    licenseExpiry: new Date("2030-01-01T00:00:00.000Z"),
    verificationStatus: "VERIFIED",
    deletedAt: null,
  };

  const expiredDriver = {
    id: "drv-expired",
    name: "Expired Driver",
    licenseExpiry: new Date("2024-01-01T00:00:00.000Z"),
    verificationStatus: "VERIFIED",
    deletedAt: null,
  };

  const unverifiedDriver = {
    id: "drv-unverified",
    name: "Unverified Driver",
    licenseExpiry: new Date("2030-01-01T00:00:00.000Z"),
    verificationStatus: "UNVERIFIED",
    deletedAt: null,
  };

  beforeEach(() => {
    vehicleFindFirst = jest.fn();
    driverFindFirst = jest.fn();

    service = new AssignmentGuardService({
      vehicle: { findFirst: vehicleFindFirst },
      driver: { findFirst: driverFindFirst },
    } as unknown as PrismaService);
  });

  it("passes validation when both vehicle and driver are valid and in future", async () => {
    vehicleFindFirst.mockResolvedValue(validVehicle);
    driverFindFirst.mockResolvedValue(validDriver);

    const result = await service.validateAssignment({
      vehicleId: "veh-1",
      driverId: "drv-1",
      now: new Date("2026-11-20T00:00:00.000Z"),
    });

    expect(result.warnings).toEqual([]);
    expect(result.overridden).toBe(false);
  });

  it("throws 422 with VEHICLE_INSURANCE_EXPIRED when vehicle insurance is expired", async () => {
    vehicleFindFirst.mockResolvedValue(expiredVehicle);

    await expect(
      service.validateAssignment({
        vehicleId: "veh-expired",
        now: new Date("2026-11-20T00:00:00.000Z"),
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    try {
      await service.validateAssignment({
        vehicleId: "veh-expired",
        now: new Date("2026-11-20T00:00:00.000Z"),
      });
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        statusCode: 422,
        error: "ASSIGNMENT_WARNING",
        warnings: ["VEHICLE_INSURANCE_EXPIRED"],
      });
    }
  });

  it("throws 422 with DRIVER_LICENSE_EXPIRED when driver license is expired", async () => {
    driverFindFirst.mockResolvedValue(expiredDriver);

    try {
      await service.validateAssignment({
        driverId: "drv-expired",
        now: new Date("2026-11-20T00:00:00.000Z"),
      });
      fail("Should have thrown 422");
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        statusCode: 422,
        error: "ASSIGNMENT_WARNING",
        warnings: ["DRIVER_LICENSE_EXPIRED"],
      });
    }
  });

  it("throws 422 with DRIVER_UNVERIFIED when driver is unverified", async () => {
    driverFindFirst.mockResolvedValue(unverifiedDriver);

    try {
      await service.validateAssignment({
        driverId: "drv-unverified",
        now: new Date("2026-11-20T00:00:00.000Z"),
      });
      fail("Should have thrown 422");
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        statusCode: 422,
        error: "ASSIGNMENT_WARNING",
        warnings: ["DRIVER_UNVERIFIED"],
      });
    }
  });

  it("allows proceeding with overridden=true when overrideReason is explicitly provided", async () => {
    vehicleFindFirst.mockResolvedValue(expiredVehicle);
    driverFindFirst.mockResolvedValue(expiredDriver);

    const result = await service.validateAssignment({
      vehicleId: "veh-expired",
      driverId: "drv-expired",
      overrideReason: "Management emergency exception: vehicle renewal pending at RTO",
      now: new Date("2026-11-20T00:00:00.000Z"),
    });

    expect(result.overridden).toBe(true);
    expect(result.warnings).toContain("VEHICLE_INSURANCE_EXPIRED");
    expect(result.warnings).toContain("DRIVER_LICENSE_EXPIRED");
  });
});
