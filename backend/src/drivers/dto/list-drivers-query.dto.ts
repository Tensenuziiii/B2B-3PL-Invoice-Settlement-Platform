import { Type } from "class-transformer";
import { IsBooleanString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListDriversQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBooleanString() active?: string;
}
