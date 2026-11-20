import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class ListInvoicesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}
