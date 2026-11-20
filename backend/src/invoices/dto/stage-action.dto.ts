import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApproveStageDto {
  @ApiPropertyOptional({ description: "Remarks on approval" })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class HoldStageDto {
  @ApiProperty({ description: "Reason for placing approval stage on hold" })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional({ description: "Detailed remarks / actions needed" })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReleaseStageHoldDto {
  @ApiPropertyOptional({ description: "Remarks on releasing hold" })
  @IsOptional()
  @IsString()
  remarks?: string;
}
