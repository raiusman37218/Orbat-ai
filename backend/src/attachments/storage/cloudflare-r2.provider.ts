import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  StorageProvider,
  PresignedUploadParams,
  PresignedUploadResult,
  FileMetadata,
} from './storage-provider.interface';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class CloudflareR2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(CloudflareR2StorageProvider.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('storage.accountId');
    const accessKeyId = this.config.get<string>('storage.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.secretAccessKey');
    this.bucketName =
      this.config.get<string>('storage.bucketName') || 'orbat-chat-uploads';
    this.publicBaseUrl = this.config.get<string>('storage.publicUrl');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(`Cloudflare R2 Storage initialized for bucket: ${this.bucketName}`);
    } else {
      this.logger.warn(
        'Cloudflare R2 credentials missing; file storage running in mock/fallback mode.',
      );
    }
  }

  async getPresignedUploadUrl(
    params: PresignedUploadParams,
  ): Promise<PresignedUploadResult> {
    const { workspaceId, filename, mimeType, byteSize } = params;

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Disallowed file type: ${mimeType}. Allowed formats: images, documents, audio, videos.`,
      );
    }

    // 2. Validate file size
    if (byteSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
      );
    }

    // 3. Generate sanitized key: workspaces/{workspaceId}/attachments/{timestamp}-{uuid}.{ext}
    const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    const storageKey = `workspaces/${workspaceId}/attachments/${Date.now()}-${randomUUID()}${ext}`;
    const expiresInSeconds = 3600; // 1 hour

    let uploadUrl = `https://mock-r2.orbat.internal/${this.bucketName}/${storageKey}`;

    if (this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        ContentType: mimeType,
        ContentLength: byteSize,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    }

    const publicUrl = this.publicBaseUrl
      ? `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`
      : undefined;

    return {
      uploadUrl,
      storageKey,
      publicUrl,
      expiresInSeconds,
    };
  }

  async getPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    }

    if (!this.s3Client) {
      return `https://mock-r2.orbat.internal/${this.bucketName}/${storageKey}?mock_token=123`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    if (!this.s3Client) {
      this.logger.log(`[Mock] Deleted file: ${storageKey}`);
      return true;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to delete file ${storageKey}: ${err.message}`);
      return false;
    }
  }

  async getFileMetadata(storageKey: string): Promise<FileMetadata | null> {
    if (!this.s3Client) {
      return {
        size: 1024,
        contentType: 'application/octet-stream',
        lastModified: new Date(),
      };
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });
      const response = await this.s3Client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified,
      };
    } catch (err: any) {
      this.logger.warn(`Could not head object ${storageKey}: ${err.message}`);
      return null;
    }
  }
}

