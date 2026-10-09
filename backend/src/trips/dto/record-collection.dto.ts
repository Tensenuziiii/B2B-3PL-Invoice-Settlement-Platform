import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { CollectionMode } from "@prisma/client";

export class RecordCollectionDto {
  @IsUUID()
  tripStopId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  actualAmount!: number;

  @IsEnum(CollectionMode)
  mode!: CollectionMode;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
