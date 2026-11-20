import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateRateCardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
