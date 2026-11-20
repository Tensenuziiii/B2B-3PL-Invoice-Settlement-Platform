import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class GenerateFromPodDto {
  @ApiProperty({ description: "POD id to link this invoice to" })
  @IsUUID()
  podId!: string;

  @ApiPropertyOptional({ description: "Subtotal amount in paise (optional override)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ description: "GST rate percentage (defaults to 18)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gstRate?: number;

  @ApiPropertyOptional({ description: "Invoice issue date (ISO 8601). Defaults to today." })
  @IsOptional()
  @IsISO8601()
  issueDate?: string;

  @ApiPropertyOptional({ description: "Payment due date (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({ description: "Notes / remarks on the invoice" })
  @IsOptional()
  @IsString()
  remarks?: string;
}
