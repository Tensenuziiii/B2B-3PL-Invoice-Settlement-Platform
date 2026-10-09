import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PodDocumentType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES } from "../storage/storage.service";
import { PodsService } from "./pods.service";
import { tenantStorage } from "../core/tenant/tenant.context";

describe("PodsService", () => {
  let service: PodsService;
  let tripStopFindFirst: jest.Mock;
  let podDocumentCreate: jest.Mock;
  let podDocumentFindFirst: jest.Mock;
  let podDocumentFindMany: jest.Mock;

  let storageValidateUpload: jest.Mock;
  let storagePresignPut: jest.Mock;
  let storagePresignGet: jest.Mock;
  let storageExists: jest.Mock;
  let storageDelete: jest.Mock;

  beforeEach(() => {
    tenantStorage.enterWith({ organizationId: "org-test", userId: "user-test" });

    tripStopFindFirst = jest.fn().mockResolvedValue({
      id: "stop-1",
      tripId: "trip-999",
      trip: { id: "trip-999" },
    });
    podDocumentCreate = jest.fn().mockImplementation((args: any) => Promise.resolve({ id: "doc-1", ...args.data }));
    podDocumentFindFirst = jest.fn().mockResolvedValue({
      id: "doc-1",
      organizationId: "org-test",
      tripStopId: "stop-1",
      s3Key: "orgs/org-test/trips/trip-999/stops/stop-1/doc-1.jpg",
    });
    podDocumentFindMany = jest.fn().mockResolvedValue([]);

    const mockPrisma = {
      tripStop: {
        findFirst: tripStopFindFirst,
      },
      podDocument: {
        create: podDocumentCreate,
        findFirst: podDocumentFindFirst,
        findMany: podDocumentFindMany,
      },
    } as unknown as PrismaService;

    storageValidateUpload = jest.fn().mockImplementation((contentType: string, sizeBytes: number) => {
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new Error(`Unsupported content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`);
      }
      if (sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`);
      }
    });
    storagePresignPut = jest.fn().mockResolvedValue("https://s3.example.com/presigned-put");
    storagePresignGet = jest.fn().mockResolvedValue("https://s3.example.com/presigned-get");
    storageExists = jest.fn().mockResolvedValue(true);
    storageDelete = jest.fn().mockResolvedValue(undefined);

    const mockStorage = {
      validateUpload: storageValidateUpload,
      presignPut: storagePresignPut,
      presignGet: storagePresignGet,
      exists: storageExists,
      delete: storageDelete,
    } as unknown as StorageService;

    service = new PodsService(mockPrisma, mockStorage);
  });

  afterEach(() => {
    tenantStorage.disable();
  });

  it("1. presignUpload() rejects unsupported content type (image/gif)", async () => {
    await expect(
      service.presignUpload({
        tripStopId: "stop-1",
        documentType: PodDocumentType.PHOTO,
        contentType: "image/gif",
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("2. presignUpload() rejects file size over 10 MB", async () => {
    await expect(
      service.presignUpload({
        tripStopId: "stop-1",
        documentType: PodDocumentType.PHOTO,
        contentType: "image/jpeg",
        sizeBytes: 10 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("3. presignUpload() rejects when tripStop not found", async () => {
    tripStopFindFirst.mockResolvedValue(null);

    await expect(
      service.presignUpload({
        tripStopId: "stop-unknown",
        documentType: PodDocumentType.PHOTO,
        contentType: "image/jpeg",
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("4. presignUpload() builds s3Key with correct prefix orgs/{orgId}/trips/...", async () => {
    const result = await service.presignUpload({
      tripStopId: "stop-1",
      documentType: PodDocumentType.PHOTO,
      contentType: "image/jpeg",
      sizeBytes: 1024,
    });

    expect(result.url).toBe("https://s3.example.com/presigned-put");
    expect(result.s3Key).toMatch(/^orgs\/org-test\/trips\/trip-999\/stops\/stop-1\/[a-f0-9-]+\.jpg$/);
    expect(storagePresignPut).toHaveBeenCalledWith(result.s3Key, "image/jpeg", 300);
    expect(result.expiresIn).toBe(300);
    expect(result.maxSizeBytes).toBe(10 * 1024 * 1024);
  });

  it("5. confirmUpload() rejects when storage.exists() returns false", async () => {
    storageExists.mockResolvedValue(false);

    await expect(
      service.confirmUpload(
        {
          tripStopId: "stop-1",
          documentType: PodDocumentType.PHOTO,
          s3Key: "orgs/org-test/trips/trip-999/stops/stop-1/test.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1024,
        },
        "user-test",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("6. confirmUpload() rejects when s3Key has wrong org prefix", async () => {
    storageExists.mockResolvedValue(true);

    await expect(
      service.confirmUpload(
        {
          tripStopId: "stop-1",
          documentType: PodDocumentType.PHOTO,
          s3Key: "orgs/wrong-org/trips/trip-999/stops/stop-1/test.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1024,
        },
        "user-test",
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("7. downloadUrl() throws NotFoundException when doc not found", async () => {
    podDocumentFindFirst.mockResolvedValue(null);

    await expect(service.downloadUrl("unknown-doc")).rejects.toThrow(NotFoundException);
  });
});
