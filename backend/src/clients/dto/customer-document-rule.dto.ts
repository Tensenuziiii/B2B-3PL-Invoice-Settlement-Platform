import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { PartialType } from "@nestjs/swagger";

export class CreateCustomerDocumentRuleDto {
  @IsString()
  @MinLength(2)
  documentType!: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDocumentRuleDto extends PartialType(CreateCustomerDocumentRuleDto) {}
