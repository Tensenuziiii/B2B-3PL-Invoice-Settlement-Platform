import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  @Matches(/^[A-Z0-9-_]+$/i, { message: "code must be alphanumeric with - or _" })
  code!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Z]{15}$/i, { message: "gstin must be a 15-character GSTIN" })
  gstin?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}$/, { message: "stateCode must be a 2-digit code" })
  stateCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  creditDays?: number;

  @IsOptional()
  digitalPodEnabled?: boolean;
}
