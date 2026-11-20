import { IsDateString, IsOptional } from "class-validator";

export class CalculateChargeDto {
  @IsDateString()
  onDate!: string;

  @IsOptional()
  @IsDateString()
  serviceDate?: string;
}
