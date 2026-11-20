import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { requireTenant } from "../core/tenant/tenant.context";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";

@Injectable()
export class PodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async presignUpload(dto: PresignUploadDto) {
    const { organizationId } = requireTenant();

    // Validate content type and size
    try {
      this.storage.validateUpload(dto.contentType, dto.sizeBytes);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    // Verify trip stop belongs to current tenant
    const stop = await this.prisma.tripStop.findFirst({
      where: { id: dto.tripStopId },
      include: { trip: true },
    });
    if (!stop) throw new NotFoundException("Trip stop not found.");

    // Build S3 key: orgs/{orgId}/trips/{tripId}/stops/{stopId}/{uuid}.{ext}
    const ext = this.extFromContentType(dto.contentType);
    const s3Key = `orgs/${organizationId}/trips/${stop.tripId}/stops/${dto.tripStopId}/${randomUUID()}.${ext}`;

    const url = await this.storage.presignPut(s3Key, dto.contentType, 300);

    return {
      url,
      s3Key,
      expiresIn: 300,
      maxSizeBytes: 10 * 1024 * 1024,
    };
  }

  async confirmUpload(dto: ConfirmUploadDto, uploadedById: string) {
    const { organizationId } = requireTenant();

    // Verify trip stop belongs to current tenant
    const stop = await this.prisma.tripStop.findFirst({
      where: { id: dto.tripStopId },
    });
    if (!stop) throw new NotFoundException("Trip stop not found.");

    // Verify the object exists in storage
    const exists = await this.storage.exists(dto.s3Key);
    if (!exists) {
      throw new BadRequestException("Object not found in storage. Upload may have failed.");
    }

    // Verify the s3Key belongs to this org (path prefix check)
    if (!dto.s3Key.startsWith(`orgs/${organizationId}/`)) {
      throw new BadRequestException("Invalid storage key prefix.");
    }

    const doc = await this.prisma.podDocument.create({
      data: {
        organizationId,
        tripStopId: dto.tripStopId,
        documentType: dto.documentType,
        s3Key: dto.s3Key,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        sha256: dto.sha256 ?? null,
        signatoryName: dto.signatoryName ?? null,
        dockGpsLat: dto.dockGpsLat ?? null,
        dockGpsLng: dto.dockGpsLng ?? null,
        uploadedById,
      },
    });

    return doc;
  }

  async listForStop(tripStopId: string) {
    const stop = await this.prisma.tripStop.findFirst({ where: { id: tripStopId } });
    if (!stop) throw new NotFoundException("Trip stop not found.");
    return this.prisma.podDocument.findMany({
      where: { tripStopId },
      orderBy: { createdAt: "asc" },
    });
  }

  async downloadUrl(podDocumentId: string) {
    const doc = await this.prisma.podDocument.findFirst({ where: { id: podDocumentId } });
    if (!doc) throw new NotFoundException("POD document not found.");
    const url = await this.storage.presignGet(doc.s3Key, 900);
    return { url, expiresIn: 900 };
  }

  private extFromContentType(contentType: string): string {
    switch (contentType) {
      case "image/jpeg": return "jpg";
      case "image/png":  return "png";
      case "application/pdf": return "pdf";
      default: return "bin";
    }
  }
}
