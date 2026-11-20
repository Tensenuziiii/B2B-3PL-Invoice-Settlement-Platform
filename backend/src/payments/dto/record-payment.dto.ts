import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class RecordPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"])
  method!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
