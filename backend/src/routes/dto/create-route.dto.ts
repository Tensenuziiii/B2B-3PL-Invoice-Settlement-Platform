import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateRouteDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(2)
  origin!: string;

  @IsString()
  @MinLength(2)
  destination!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  expectedKm!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  standardTollEstimate?: number;
}
