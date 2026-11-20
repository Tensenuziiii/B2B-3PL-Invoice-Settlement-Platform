import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export enum CheckItemResult {
  PASS = "PASS",
  FAIL = "FAIL",
  WAIVED = "WAIVED",
}

export class CheckItemDto {
  @ApiProperty({ description: "Check item code, e.g. STAMP_LEGIBLE, SIGNATURE_VALID, DATE_RECORDED, QTY_MATCH" })
  @IsString()
  itemCode!: string;

  @ApiProperty({ enum: CheckItemResult })
  @IsEnum(CheckItemResult)
  result!: CheckItemResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitChecklistDto {
  @ApiProperty({ type: [CheckItemDto], description: "Array of checklist item results" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckItemDto)
  items!: CheckItemDto[];
}
