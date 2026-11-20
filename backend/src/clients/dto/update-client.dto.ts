import { PartialType } from "@nestjs/swagger";
import { CreateClientDto } from "./create-client.dto";
import { IsIn, IsOptional } from "class-validator";

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"])
  status?: string;
}
