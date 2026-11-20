import { Type } from "class-transformer";
import { IsEnum, IsInt, IsString, IsUUID, Min } from "class-validator";
import { PodDocumentType } from "@prisma/client";

export class PresignUploadDto {
  @IsUUID()
  tripStopId!: string;

  @IsEnum(PodDocumentType)
  documentType!: PodDocumentType;

  @IsString()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
