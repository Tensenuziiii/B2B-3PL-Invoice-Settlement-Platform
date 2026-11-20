import { PartialType } from "@nestjs/swagger";
import { CreateOwnerDto } from "./create-owner.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateOwnerDto extends PartialType(CreateOwnerDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
