import { PartialType } from "@nestjs/swagger";
import { CreateDriverDto } from "./create-driver.dto";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  dutyStatus?: string;
}
