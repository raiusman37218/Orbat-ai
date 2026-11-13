import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let mockDb: any;
  let mockStorage: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    mockStorage = {
      getPresignedUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://r2.test/upload',
        storageKey: 'workspaces/ws-1/attachments/test.png',
        expiresInSeconds: 3600,
      }),
      getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/download'),
      deleteFile: vi.fn().mockResolvedValue(true),
      getFileMetadata: vi.fn().mockResolvedValue({ size: 2048, contentType: 'image/png' }),
    };

    service = new AttachmentsService(mockDb, mockStorage);
  });

  it('should create presigned upload and save pending record', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{
        id: 'att-1',
        workspace_id: 'ws-1',
        storage_key: 'workspaces/ws-1/attachments/test.png',
        original_name: 'test.png',
        mime_type: 'image/png',
        byte_size: 2048,
        status: 'pending',
      }],
    });

    const res = await service.createPresignedUpload('ws-1', {
      filename: 'test.png',
      mimeType: 'image/png',
      byteSize: 2048,
    });

    expect(res.attachmentId).toBe('att-1');
    expect(res.uploadUrl).toBe('https://r2.test/upload');
    expect(mockStorage.getPresignedUploadUrl).toHaveBeenCalled();
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.attachments'),
      expect.any(Array),
    );
  });

  it('should confirm upload by checking storage metadata and updating status', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ id: 'att-1', storage_key: 'workspaces/ws-1/attachments/test.png', status: 'pending' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'att-1', status: 'uploaded' }],
      });

    const res = await service.confirmUpload('ws-1', 'att-1');
    expect(res.success).toBe(true);
    expect(res.attachment.status).toBe('uploaded');
    expect(mockStorage.getFileMetadata).toHaveBeenCalled();
  });

  it('should get presigned download url', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{
        id: 'att-1',
        storage_key: 'workspaces/ws-1/attachments/test.png',
        original_name: 'test.png',
        mime_type: 'image/png',
      }],
    });

    const res = await service.getDownloadUrl('ws-1', 'att-1');
    expect(res.downloadUrl).toBe('https://r2.test/download');
    expect(mockStorage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'workspaces/ws-1/attachments/test.png',
    );
  });

  it('should delete attachment from storage and database', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [{ id: 'att-1', storage_key: 'workspaces/ws-1/attachments/test.png' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await service.deleteAttachment('ws-1', 'att-1');
    expect(res.success).toBe(true);
    expect(mockStorage.deleteFile).toHaveBeenCalledWith('workspaces/ws-1/attachments/test.png');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM public.attachments'),
      ['att-1', 'ws-1'],
    );
  });
});

