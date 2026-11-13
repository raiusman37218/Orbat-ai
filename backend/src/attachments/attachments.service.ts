import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from './storage/storage-provider.interface';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async createPresignedUpload(
    workspaceId: string,
    dto: PresignUploadDto,
    uploader?: AuthenticatedUser,
    visitorId?: string,
  ) {
    const uploadResult = await this.storage.getPresignedUploadUrl({
      workspaceId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });

    const uploaderType = uploader ? 'agent' : 'visitor';
    const uploaderId = uploader?.id || null;

    const res = await this.db.query(
      `INSERT INTO public.attachments (
         workspace_id, conversation_id, storage_key, original_name,
         mime_type, byte_size, status, uploader_type, uploader_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
       RETURNING id, workspace_id, conversation_id, storage_key, original_name,
                 mime_type, byte_size, status, created_at`,
      [
        workspaceId,
        dto.conversationId || null,
        uploadResult.storageKey,
        dto.filename,
        dto.mimeType,
        dto.byteSize,
        uploaderType,
        uploaderId,
        JSON.stringify({ visitorId: visitorId || null }),
      ],
    );

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

  async confirmUpload(workspaceId: string, attachmentId: string) {
    const res = await this.db.query(
      `SELECT id, storage_key, status
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [attachmentId, workspaceId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Attachment ${attachmentId} not found.`);
    }

    const attachment = res.rows[0];
    const metadata = await this.storage.getFileMetadata(attachment.storage_key);

    const updateRes = await this.db.query(
      `UPDATE public.attachments
       SET status = 'uploaded',
           updated_at = now()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [attachmentId, workspaceId],
    );

    return {
      success: true,
      attachment: updateRes.rows[0],
      verifiedMetadata: metadata,
    };
  }

  async getDownloadUrl(workspaceId: string, attachmentId: string) {
    const res = await this.db.query(
      `SELECT id, storage_key, original_name, mime_type, status
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [attachmentId, workspaceId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Attachment ${attachmentId} not found.`);
    }

    const attachment = res.rows[0];
    const downloadUrl = await this.storage.getPresignedDownloadUrl(
      attachment.storage_key,
    );

    return {
      attachmentId: attachment.id,
      downloadUrl,
      originalName: attachment.original_name,
      mimeType: attachment.mime_type,
    };
  }

  async deleteAttachment(workspaceId: string, attachmentId: string) {
    const res = await this.db.query(
      `SELECT id, storage_key
       FROM public.attachments
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`,
      [attachmentId, workspaceId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Attachment ${attachmentId} not found.`);
    }

    const attachment = res.rows[0];
    await this.storage.deleteFile(attachment.storage_key);

    await this.db.query(
      `DELETE FROM public.attachments WHERE id = $1 AND workspace_id = $2`,
      [attachmentId, workspaceId],
    );

    return { success: true, deletedId: attachmentId };
  }
}

