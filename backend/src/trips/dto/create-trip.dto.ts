import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID,
  Min, ValidateNested,
} from "class-validator";
import { CreateTripStopDto } from "./create-trip-stop.dto";

export class CreateTripDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  lrNumber?: string;

  @IsOptional()
  @IsDateString()
  eta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerStart?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTripStopDto)
  stops!: CreateTripStopDto[];
}
