import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { CounterpartyType, RateType } from "@prisma/client";

export class ResolveRateDto {
  @IsEnum(CounterpartyType)
  counterpartyType!: CounterpartyType;

  @IsUUID()
  counterpartyId!: string; // clientId or vendorId depending on type

  @IsEnum(RateType)
  rateType!: RateType;

  @IsDateString()
  onDate!: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsString()
  tripType?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}
