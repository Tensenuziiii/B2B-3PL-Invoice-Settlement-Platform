import { PartialType } from "@nestjs/swagger";
import { CreateVehicleDto } from "./create-vehicle.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
