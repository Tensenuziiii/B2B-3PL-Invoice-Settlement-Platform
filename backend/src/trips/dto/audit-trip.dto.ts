import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class AuditTripDto {
  @Type(() => Number)
  @IsInt({ message: "Version must be an integer." })
  @Min(0, { message: "Version must be zero or greater." })
  version!: number;

  @IsIn(["AUDITED", "CORRECTION_REQUESTED"], { message: "Outcome must be AUDITED or CORRECTION_REQUESTED." })
  outcome!: "AUDITED" | "CORRECTION_REQUESTED";

  @IsString({ message: "Notes are required." })
  @MinLength(3, { message: "Notes must be at least 3 characters." })
  notes!: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, unknown>;
}
