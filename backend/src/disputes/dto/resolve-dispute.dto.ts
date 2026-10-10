import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Min, MinLength } from "class-validator";

export class ResolveDisputeDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsIn(["ACCEPTED", "REJECTED", "PARTIAL_ADJUSTMENT"])
  resolution!: "ACCEPTED" | "REJECTED" | "PARTIAL_ADJUSTMENT";

  @IsString()
  @MinLength(3)
  resolutionNotes!: string;
}
