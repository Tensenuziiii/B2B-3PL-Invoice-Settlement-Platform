import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { RateType } from "@prisma/client";

export class AddRateCardItemDto {
  @IsEnum(RateType)
  rateType!: RateType;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsString()
  tripType?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  rate!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
