import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AssignmentCheckResult {
  warnings: string[];
  overridden: boolean;
}

@Injectable()
export class AssignmentGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAssignment(params: {
    vehicleId?: string | null;
    driverId?: string | null;
    overrideReason?: string | null;
    now?: Date;
  }): Promise<AssignmentCheckResult> {
    const { vehicleId, driverId, overrideReason } = params;
    const now = params.now ?? new Date();
    const warnings: string[] = [];

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, deletedAt: null },
      });

      if (vehicle) {
        if (vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < now) {
          warnings.push("VEHICLE_INSURANCE_EXPIRED");
        }
        if (vehicle.fitnessExpiry && new Date(vehicle.fitnessExpiry) < now) {
          warnings.push("VEHICLE_FITNESS_EXPIRED");
        }
        if (vehicle.pucExpiry && new Date(vehicle.pucExpiry) < now) {
          warnings.push("VEHICLE_PUC_EXPIRED");
        }
      }
    }

    if (driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: driverId, deletedAt: null },
      });

      if (driver) {
        if (driver.licenseExpiry && new Date(driver.licenseExpiry) < now) {
          warnings.push("DRIVER_LICENSE_EXPIRED");
        }
        if (driver.verificationStatus && driver.verificationStatus !== "VERIFIED") {
          warnings.push(`DRIVER_${driver.verificationStatus}`);
        }
      }
    }

    if (warnings.length > 0) {
      const trimmedReason = overrideReason?.trim();
      if (!trimmedReason) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: "ASSIGNMENT_WARNING",
          message: "Assignment validation failed with named warnings. Explicit override justification required.",
          warnings,
        });
      }
      return { warnings, overridden: true };
    }

    return { warnings: [], overridden: false };
  }
}
