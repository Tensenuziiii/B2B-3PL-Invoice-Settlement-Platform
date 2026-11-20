import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per spec §20

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>("STORAGE_ENDPOINT");
    const region = this.config.get<string>("STORAGE_REGION") ?? "ap-south-1";
    const accessKeyId = this.config.getOrThrow<string>("STORAGE_ACCESS_KEY");
    const secretAccessKey = this.config.getOrThrow<string>("STORAGE_SECRET_KEY");
    const forcePathStyle = this.config.get<string>("STORAGE_FORCE_PATH_STYLE") === "true";
    this.bucket = this.config.getOrThrow<string>("STORAGE_BUCKET");

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }

  validateUpload(contentType: string, sizeBytes: number): void {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`);
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`);
    }
  }

  async presignPut(key: string, contentType: string, ttlSeconds = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async presignGet(key: string, ttlSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
