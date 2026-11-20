import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SettlementActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
