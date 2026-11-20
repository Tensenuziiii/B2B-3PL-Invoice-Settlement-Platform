import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class ListDisputesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(["DISPUTED", "UNDER_REVIEW", "RESOLVED"]) status?: string;
  @IsOptional() @IsUUID() invoiceId?: string;
}
