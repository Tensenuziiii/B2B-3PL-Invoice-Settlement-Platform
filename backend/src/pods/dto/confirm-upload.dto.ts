import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { PodDocumentType } from "@prisma/client";

export class ConfirmUploadDto {
  @IsUUID()
  tripStopId!: string;

  @IsEnum(PodDocumentType)
  documentType!: PodDocumentType;

  @IsString()
  s3Key!: string;

  @IsString()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  sha256?: string;

  @IsOptional()
  @IsString()
  signatoryName?: string;

  @IsOptional()
  @Type(() => Number)
  dockGpsLat?: number;

  @IsOptional()
  @Type(() => Number)
  dockGpsLng?: number;
}
