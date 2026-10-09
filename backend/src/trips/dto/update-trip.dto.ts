import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateTripDto {
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() lrNumber?: string;
  @IsOptional() @IsDateString() eta?: string;
}
