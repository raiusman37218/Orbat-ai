"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const attachments_service_1 = require("./attachments.service");
(0, vitest_1.describe)('AttachmentsService', () => {
    let service;
    let mockDb;
    let mockStorage;
    (0, vitest_1.beforeEach)(() => {
        mockDb = {
            query: vitest_1.vi.fn(),
        };
        mockStorage = {
            getPresignedUploadUrl: vitest_1.vi.fn().mockResolvedValue({
                uploadUrl: 'https://r2.test/upload',
                storageKey: 'workspaces/ws-1/attachments/test.png',
                expiresInSeconds: 3600,
            }),
            getPresignedDownloadUrl: vitest_1.vi.fn().mockResolvedValue('https://r2.test/download'),
            deleteFile: vitest_1.vi.fn().mockResolvedValue(true),
            getFileMetadata: vitest_1.vi.fn().mockResolvedValue({ size: 2048, contentType: 'image/png' }),
        };
        service = new attachments_service_1.AttachmentsService(mockDb, mockStorage);
    });
    (0, vitest_1.it)('should create presigned upload and save pending record', async () => {
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
        (0, vitest_1.expect)(res.attachmentId).toBe('att-1');
        (0, vitest_1.expect)(res.uploadUrl).toBe('https://r2.test/upload');
        (0, vitest_1.expect)(mockStorage.getPresignedUploadUrl).toHaveBeenCalled();
        (0, vitest_1.expect)(mockDb.query).toHaveBeenCalledWith(vitest_1.expect.stringContaining('INSERT INTO public.attachments'), vitest_1.expect.any(Array));
    });
    (0, vitest_1.it)('should confirm upload by checking storage metadata and updating status', async () => {
        mockDb.query
            .mockResolvedValueOnce({
            rows: [{ id: 'att-1', storage_key: 'workspaces/ws-1/attachments/test.png', status: 'pending' }],
        })
            .mockResolvedValueOnce({
            rows: [{ id: 'att-1', status: 'uploaded' }],
        });
        const res = await service.confirmUpload('ws-1', 'att-1');
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(res.attachment.status).toBe('uploaded');
        (0, vitest_1.expect)(mockStorage.getFileMetadata).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should get presigned download url', async () => {
        mockDb.query.mockResolvedValueOnce({
            rows: [{
                    id: 'att-1',
                    storage_key: 'workspaces/ws-1/attachments/test.png',
                    original_name: 'test.png',
                    mime_type: 'image/png',
                }],
        });
        const res = await service.getDownloadUrl('ws-1', 'att-1');
        (0, vitest_1.expect)(res.downloadUrl).toBe('https://r2.test/download');
        (0, vitest_1.expect)(mockStorage.getPresignedDownloadUrl).toHaveBeenCalledWith('workspaces/ws-1/attachments/test.png');
    });
    (0, vitest_1.it)('should delete attachment from storage and database', async () => {
        mockDb.query
            .mockResolvedValueOnce({
            rows: [{ id: 'att-1', storage_key: 'workspaces/ws-1/attachments/test.png' }],
        })
            .mockResolvedValueOnce({ rowCount: 1 });
        const res = await service.deleteAttachment('ws-1', 'att-1');
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(mockStorage.deleteFile).toHaveBeenCalledWith('workspaces/ws-1/attachments/test.png');
        (0, vitest_1.expect)(mockDb.query).toHaveBeenCalledWith(vitest_1.expect.stringContaining('DELETE FROM public.attachments'), ['att-1', 'ws-1']);
    });
});
//# sourceMappingURL=attachments.service.spec.js.map