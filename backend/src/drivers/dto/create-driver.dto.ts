import { IsDateString, IsOptional, IsPhoneNumber, IsString, IsUUID, MinLength } from "class-validator";

export class CreateDriverDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsPhoneNumber("IN")
  phone!: string;

  @IsOptional()
  @IsString()
  licenseNo?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
