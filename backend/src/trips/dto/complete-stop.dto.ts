import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CompleteStopDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveredQty?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
