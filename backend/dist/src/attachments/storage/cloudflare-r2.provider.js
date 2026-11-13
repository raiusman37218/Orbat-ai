"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CloudflareR2StorageProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudflareR2StorageProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
const path = require("path");
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
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
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
let CloudflareR2StorageProvider = CloudflareR2StorageProvider_1 = class CloudflareR2StorageProvider {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(CloudflareR2StorageProvider_1.name);
        this.s3Client = null;
        const accountId = this.config.get('storage.accountId');
        const accessKeyId = this.config.get('storage.accessKeyId');
        const secretAccessKey = this.config.get('storage.secretAccessKey');
        this.bucketName =
            this.config.get('storage.bucketName') || 'orbat-chat-uploads';
        this.publicBaseUrl = this.config.get('storage.publicUrl');
        if (accountId && accessKeyId && secretAccessKey) {
            this.s3Client = new client_s3_1.S3Client({
                region: 'auto',
                endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
            this.logger.log(`Cloudflare R2 Storage initialized for bucket: ${this.bucketName}`);
        }
        else {
            this.logger.warn('Cloudflare R2 credentials missing; file storage running in mock/fallback mode.');
        }
    }
    async getPresignedUploadUrl(params) {
        const { workspaceId, filename, mimeType, byteSize } = params;
        if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
            throw new common_1.BadRequestException(`Disallowed file type: ${mimeType}. Allowed formats: images, documents, audio, videos.`);
        }
        if (byteSize > MAX_FILE_SIZE_BYTES) {
            throw new common_1.BadRequestException(`File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
        }
        const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
        const storageKey = `workspaces/${workspaceId}/attachments/${Date.now()}-${(0, crypto_1.randomUUID)()}${ext}`;
        const expiresInSeconds = 3600;
        let uploadUrl = `https://mock-r2.orbat.internal/${this.bucketName}/${storageKey}`;
        if (!this.s3Client) {
            if (this.config.get('nodeEnv') === 'production') {
                throw new common_1.ServiceUnavailableException('Object storage (Cloudflare R2) is not configured.');
            }
        }
        else {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: storageKey,
                ContentType: mimeType,
                ContentLength: byteSize,
            });
            uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
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
    async getPresignedDownloadUrl(storageKey, expiresInSeconds = 3600) {
        if (this.s3Client) {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: storageKey,
            });
            return (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: expiresInSeconds });
        }
        if (this.publicBaseUrl) {
            return `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
        }
        if (this.config.get('nodeEnv') === 'production') {
            throw new common_1.ServiceUnavailableException('Object storage (Cloudflare R2) is not configured.');
        }
        return `https://mock-r2.orbat.internal/${this.bucketName}/${storageKey}?mock_token=123`;
    }
    async deleteFile(storageKey) {
        if (!this.s3Client) {
            this.logger.log(`[Mock] Deleted file: ${storageKey}`);
            return true;
        }
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: storageKey,
            });
            await this.s3Client.send(command);
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to delete file ${storageKey}: ${err.message}`);
            return false;
        }
    }
    async getFileMetadata(storageKey) {
        if (!this.s3Client) {
            return {
                size: 1024,
                contentType: 'application/octet-stream',
                lastModified: new Date(),
            };
        }
        try {
            const command = new client_s3_1.HeadObjectCommand({
                Bucket: this.bucketName,
                Key: storageKey,
            });
            const response = await this.s3Client.send(command);
            return {
                size: response.ContentLength || 0,
                contentType: response.ContentType || 'application/octet-stream',
                lastModified: response.LastModified,
            };
        }
        catch (err) {
            this.logger.warn(`Could not head object ${storageKey}: ${err.message}`);
            return null;
        }
    }
};
exports.CloudflareR2StorageProvider = CloudflareR2StorageProvider;
exports.CloudflareR2StorageProvider = CloudflareR2StorageProvider = CloudflareR2StorageProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CloudflareR2StorageProvider);
//# sourceMappingURL=cloudflare-r2.provider.js.map