import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class ListSettlementsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(["DRAFT", "SUBMITTED", "APPROVED", "PAID"]) status?: string;
  @IsOptional() @IsUUID() vendorId?: string;
}
