import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateDisputeDto {
  @IsUUID()
  invoiceLineId!: string;

  @IsString()
  @MinLength(3)
  reasonCode!: string;

  @IsString()
  @MinLength(3)
  comment!: string;

  @IsOptional()
  @IsUUID()
  evidenceDocId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountPaise!: number;
}
