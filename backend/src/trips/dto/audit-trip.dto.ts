import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class AuditTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsIn(["AUDITED", "CORRECTION_REQUESTED"])
  outcome!: "AUDITED" | "CORRECTION_REQUESTED";

  @IsString()
  @MinLength(3)
  notes!: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, unknown>;
}
