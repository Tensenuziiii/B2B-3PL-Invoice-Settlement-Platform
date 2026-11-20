import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PodHoldDto {
  @ApiProperty({ description: "Reason for placing POD on hold" })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiProperty({ description: "Additional remarks / action required" })
  @IsString()
  @MinLength(3)
  remarks!: string;
}

export class PodReleaseHoldDto {
  @ApiProperty({ description: "Reason for releasing hold (e.g. document corrected)" })
  @IsString()
  @MinLength(3)
  reason!: string;
}
