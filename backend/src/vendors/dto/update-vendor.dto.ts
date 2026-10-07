import { PartialType } from "@nestjs/swagger";
import { CreateVendorDto } from "./create-vendor.dto";
import { IsIn, IsOptional } from "class-validator";

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status?: string;
}
