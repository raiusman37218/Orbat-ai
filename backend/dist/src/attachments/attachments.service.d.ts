import { DatabaseService } from '../database/database.service';
import { StorageProvider } from './storage/storage-provider.interface';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class AttachmentsService {
    private readonly db;
    private readonly storage;
    private readonly logger;
    constructor(db: DatabaseService, storage: StorageProvider);
    createPresignedUpload(workspaceId: string, dto: PresignUploadDto, uploader?: AuthenticatedUser, visitorId?: string): Promise<{
        attachmentId: any;
        uploadUrl: string;
        storageKey: string;
        publicUrl: string | undefined;
        expiresInSeconds: number;
        attachment: any;
    }>;
    confirmUpload(workspaceId: string, attachmentId: string): Promise<{
        success: boolean;
        attachment: any;
        verifiedMetadata: import("./storage/storage-provider.interface").FileMetadata | null;
    }>;
    getDownloadUrl(workspaceId: string, attachmentId: string): Promise<{
        attachmentId: any;
        downloadUrl: string;
        originalName: any;
        mimeType: any;
    }>;
    deleteAttachment(workspaceId: string, attachmentId: string): Promise<{
        success: boolean;
        deletedId: string;
    }>;
}
