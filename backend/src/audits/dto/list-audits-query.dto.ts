import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, Max } from "class-validator";

export class ListAuditsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
}
