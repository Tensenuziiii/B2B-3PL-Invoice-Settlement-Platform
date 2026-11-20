import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PodCourierDto {
  @ApiProperty({ description: "Name of courier company / person" })
  @IsString()
  @MinLength(2)
  courierName!: string;

  @ApiPropertyOptional({ description: "Courier AWB / tracking number" })
  @IsOptional()
  @IsString()
  courierTrackingNo?: string;
}

export class PodMarkLostDto {
  @ApiProperty({ description: "Reason original POD is considered lost" })
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class PodDuplicateRequestDto {
  @ApiProperty({ description: "Notes / instructions for requesting duplicate from customer" })
  @IsString()
  @MinLength(5)
  notes!: string;
}
