import { IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateOwnerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsIn(["INDIVIDUAL", "FLEET_OPERATOR", "TRANSPORTER"])
  partyType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, { message: "pan must be a valid 10-character PAN format" })
  pan?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
