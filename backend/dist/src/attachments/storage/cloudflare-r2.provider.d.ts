import { ConfigService } from '@nestjs/config';
import { StorageProvider, PresignedUploadParams, PresignedUploadResult, FileMetadata } from './storage-provider.interface';
export declare class CloudflareR2StorageProvider implements StorageProvider {
    private readonly config;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    private readonly publicBaseUrl?;
    constructor(config: ConfigService);
    getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
    getPresignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
    deleteFile(storageKey: string): Promise<boolean>;
    getFileMetadata(storageKey: string): Promise<FileMetadata | null>;
}
