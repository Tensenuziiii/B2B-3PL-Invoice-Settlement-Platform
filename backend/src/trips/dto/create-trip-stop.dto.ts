import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { CollectionMode } from "@prisma/client";

export class CreateTripStopDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedQty?: number;

  @IsOptional()
  @IsEnum(CollectionMode)
  collectionType?: CollectionMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCollection?: number;
}
