import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateVehicleDto {
  @IsString()
  @MinLength(4)
  regNo!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  capacityKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentOdometer?: number;
}
