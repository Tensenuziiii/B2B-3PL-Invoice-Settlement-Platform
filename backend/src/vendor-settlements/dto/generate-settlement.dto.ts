import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class GenerateSettlementDto {
  @IsUUID()
  vendorId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  tripIds!: string[];

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
