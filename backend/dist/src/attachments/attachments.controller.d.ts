import { AttachmentsService } from './attachments.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class AttachmentsController {
    private readonly attachmentsService;
    constructor(attachmentsService: AttachmentsService);
    presignUpload(workspaceId: string, dto: PresignUploadDto, user?: AuthenticatedUser): Promise<{
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
