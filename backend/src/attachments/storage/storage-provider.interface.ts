export interface PresignedUploadParams {
  workspaceId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  publicUrl?: string;
  expiresInSeconds: number;
}

export interface FileMetadata {
  size: number;
  contentType: string;
  lastModified?: Date;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export interface StorageProvider {
  getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
  getPresignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(storageKey: string): Promise<boolean>;
  getFileMetadata(storageKey: string): Promise<FileMetadata | null>;
}

