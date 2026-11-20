import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { ExpenseType } from "@prisma/client";

export class RecordExpenseDto {
  @IsEnum(ExpenseType)
  type!: ExpenseType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  receiptRef?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
