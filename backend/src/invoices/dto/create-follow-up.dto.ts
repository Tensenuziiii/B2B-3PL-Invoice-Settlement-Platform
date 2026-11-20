import { IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateFollowUpDto {
  @ApiPropertyOptional({ description: "Date/time contact was made (ISO 8601). Defaults to now." })
  @IsOptional()
  @IsISO8601()
  contactedOn?: string;

  @ApiPropertyOptional({ description: "Contact person spoken with or emailed" })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({
    description: "Outcome of follow up: PROMISE_TO_PAY | UNDER_REVIEW | CORRECTION_NEEDED | CALL_BACK | ESCALATED",
  })
  @IsString()
  @MinLength(2)
  outcome!: string;

  @ApiPropertyOptional({ description: "Detailed follow-up notes" })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ description: "Next scheduled follow up date (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  nextFollowUpOn?: string;
}
