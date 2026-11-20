import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsUUID } from "class-validator";

export class GenerateInvoiceDto {
  @IsUUID()
  clientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  tripIds!: string[];

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  gstRate?: number;
}
