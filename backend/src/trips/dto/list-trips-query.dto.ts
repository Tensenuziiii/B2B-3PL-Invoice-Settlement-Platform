import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class ListTripsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @IsIn([
    "active",
    "ASSIGNED",
    "IN_PROGRESS",
    "DELIVERY_IN_PROGRESS",
    "DELIVERED",
    "AUDIT_PENDING",
    "CORRECTION_REQUESTED",
    "AUDITED",
    "READY_FOR_BILLING",
  ])
  status?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
}
