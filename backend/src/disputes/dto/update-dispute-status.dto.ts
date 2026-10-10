import { Type } from "class-transformer";
import { IsInt, IsIn, Min } from "class-validator";

export class UpdateDisputeStatusDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsIn(["UNDER_REVIEW"])
  status!: "UNDER_REVIEW";
}
