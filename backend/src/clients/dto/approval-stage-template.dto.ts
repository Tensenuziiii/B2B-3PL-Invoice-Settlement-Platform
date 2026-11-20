import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";

export class CreateApprovalStageTemplateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  sequence!: number;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720) // up to 30 days
  slaHours?: number;
}

export class UpdateApprovalStageTemplateDto extends PartialType(CreateApprovalStageTemplateDto) {}
