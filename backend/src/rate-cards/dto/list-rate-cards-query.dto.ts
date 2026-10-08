import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { CounterpartyType } from "@prisma/client";

export class ListRateCardsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(CounterpartyType) counterpartyType?: CounterpartyType;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"]) status?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() vendorId?: string;
}
