import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Max, Min, MinLength, ValidateNested,
} from "class-validator";
import { CounterpartyType, RateType } from "@prisma/client";

export class CreateRateCardItemDto {
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

export class CreateRateCardDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEnum(CounterpartyType)
  counterpartyType!: CounterpartyType;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRateCardItemDto)
  items!: CreateRateCardItemDto[];
}
