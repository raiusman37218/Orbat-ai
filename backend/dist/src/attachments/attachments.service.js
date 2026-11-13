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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AttachmentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const storage_provider_interface_1 = require("./storage/storage-provider.interface");
let AttachmentsService = AttachmentsService_1 = class AttachmentsService {
    constructor(db, storage) {
        this.db = db;
        this.storage = storage;
        this.logger = new common_1.Logger(AttachmentsService_1.name);
    }
    async createPresignedUpload(workspaceId, dto, uploader, visitorId) {
        const uploadResult = await this.storage.getPresignedUploadUrl({
            workspaceId,
            filename: dto.filename,
            mimeType: dto.mimeType,
            byteSize: dto.byteSize,
        });
        const uploaderType = uploader ? 'agent' : 'visitor';
        const uploaderId = uploader?.id || null;
        const res = await this.db.query(`INSERT INTO public.attachments (
         workspace_id, conversation_id, storage_key, original_name,
         mime_type, byte_size, status, uploader_type, uploader_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
       RETURNING id, workspace_id, conversation_id, storage_key, original_name,
                 mime_type, byte_size, status, created_at`, [
            workspaceId,
            dto.conversationId || null,
            uploadResult.storageKey,
            dto.filename,
            dto.mimeType,
            dto.byteSize,
            uploaderType,
            uploaderId,
            JSON.stringify({ visitorId: visitorId || null }),
        ]);
        const attachment = res.rows[0];
        return {
            attachmentId: attachment.id,
            uploadUrl: uploadResult.uploadUrl,
            storageKey: uploadResult.storageKey,
            publicUrl: uploadResult.publicUrl,
            expiresInSeconds: uploadResult.expiresInSeconds,
            attachment,
        };
    }
    async confirmUpload(workspaceId, attachmentId) {
        const res = await this.db.query(`SELECT id, storage_key, status
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [attachmentId, workspaceId]);
        if (res.rows.length === 0) {
            throw new common_1.NotFoundException(`Attachment ${attachmentId} not found.`);
        }
        const attachment = res.rows[0];
        const metadata = await this.storage.getFileMetadata(attachment.storage_key);
        const updateRes = await this.db.query(`UPDATE public.attachments
       SET status = 'uploaded',
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`, [attachmentId, workspaceId]);
        return {
            success: true,
            attachment: updateRes.rows[0],
            verifiedMetadata: metadata,
        };
    }
    async getDownloadUrl(workspaceId, attachmentId) {
        const res = await this.db.query(`SELECT id, storage_key, original_name, mime_type, status
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [attachmentId, workspaceId]);
        if (res.rows.length === 0) {
            throw new common_1.NotFoundException(`Attachment ${attachmentId} not found.`);
        }
        const attachment = res.rows[0];
        const downloadUrl = await this.storage.getPresignedDownloadUrl(attachment.storage_key);
        return {
            attachmentId: attachment.id,
            downloadUrl,
            originalName: attachment.original_name,
            mimeType: attachment.mime_type,
        };
    }
    async deleteAttachment(workspaceId, attachmentId) {
        const res = await this.db.query(`SELECT id, storage_key
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [attachmentId, workspaceId]);
        if (res.rows.length === 0) {
            throw new common_1.NotFoundException(`Attachment ${attachmentId} not found.`);
        }
        const attachment = res.rows[0];
        await this.storage.deleteFile(attachment.storage_key);
        await this.db.query(`DELETE FROM public.attachments WHERE id = $1 AND workspace_id = $2`, [attachmentId, workspaceId]);
        return { success: true, deletedId: attachmentId };
    }
};
exports.AttachmentsService = AttachmentsService;
exports.AttachmentsService = AttachmentsService = AttachmentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(storage_provider_interface_1.STORAGE_PROVIDER)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService, Object])
], AttachmentsService);
//# sourceMappingURL=attachments.service.js.map