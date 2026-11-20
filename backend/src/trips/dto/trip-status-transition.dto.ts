import { IsOptional, IsString, IsUUID } from "class-validator";

export class TripStatusTransitionDto {
  @IsString()
  toStatus!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  newVehicleId?: string;

  @IsOptional()
  @IsUUID()
  newDriverId?: string;

  @IsOptional()
  @IsString()
  assignmentOverrideReason?: string;
}
