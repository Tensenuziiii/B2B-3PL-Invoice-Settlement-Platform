import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class EndTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerEnd!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
