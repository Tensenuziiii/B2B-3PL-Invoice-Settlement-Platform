import { PartialType } from "@nestjs/swagger";
import { CreateRouteDto } from "./create-route.dto";
import { IsIn, IsOptional } from "class-validator";

export class UpdateRouteDto extends PartialType(CreateRouteDto) {
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status?: string;
}
