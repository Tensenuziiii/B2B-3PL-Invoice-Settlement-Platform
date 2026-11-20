import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class ArriveStopDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsUUID()
  tripStopId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
