"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const messages_service_1 = require("./messages.service");
const realtime_emit_context_1 = require("../realtime/realtime-emit.context");
(0, vitest_1.describe)('MessagesService Security, Pagination & Outbox', () => {
    let service;
    let mockDb;
    let mockClient;
    let mockRealtime;
    let mockOutbox;
    const WS_ID = '11111111-1111-4111-8111-111111111111';
    const CONV_ID = '22222222-2222-4222-8222-222222222222';
    const AGENT_ID = '33333333-3333-4333-8333-333333333333';
    (0, vitest_1.beforeEach)(() => {
        mockClient = { query: vitest_1.vi.fn() };
        mockDb = {
            query: vitest_1.vi.fn(),
            transaction: vitest_1.vi.fn(async (cb) => cb(mockClient)),
        };
        mockRealtime = {
            emitToConversation: vitest_1.vi.fn().mockReturnValue(true),
            emitToWorkspace: vitest_1.vi.fn().mockReturnValue(true),
        };
        mockOutbox = {
            recordInTransaction: vitest_1.vi.fn().mockResolvedValue('outbox-1'),
            markPublished: vitest_1.vi.fn().mockResolvedValue(undefined),
        };
        service = new messages_service_1.MessagesService(mockDb, mockRealtime, mockOutbox);
    });
    (0, vitest_1.it)('fetches newest N messages via INNER ORDER BY DESC LIMIT and clamps limit to 100', async () => {
        mockDb.query
            .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
            .mockResolvedValueOnce({ rows: [{ id: 'm1' }, { id: 'm2' }] });
        await service.getMessages(WS_ID, CONV_ID, 500);
        const [sql, params] = mockDb.query.mock.calls[1];
        (0, vitest_1.expect)(sql).toContain('ORDER BY m.created_at DESC');
        (0, vitest_1.expect)(sql).toContain('ORDER BY latest.created_at ASC');
        (0, vitest_1.expect)(params).toEqual([CONV_ID, 100]);
    });
    (0, vitest_1.it)('blocks light_agent from sending public messages, allows internal notes', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ id: CONV_ID, visitor_id: 'vis-1' }] });
        const lightAgent = {
            id: AGENT_ID,
            email: 'light@example.com',
            name: 'Light',
            role: 'light_agent',
            workspaceId: WS_ID,
        };
        await (0, vitest_1.expect)(service.sendMessage(WS_ID, CONV_ID, { content: 'Public reply', isInternal: false }, lightAgent)).rejects.toThrow(common_1.ForbiddenException);
        mockClient.query.mockResolvedValueOnce({
            rows: [
                {
                    id: 'msg-internal',
                    conversation_id: CONV_ID,
                    sender_type: 'agent',
                    sender_id: AGENT_ID,
                    content: 'Internal note',
                    is_internal: true,
                },
            ],
        });
        const note = await service.sendMessage(WS_ID, CONV_ID, { content: 'Internal note', isInternal: true }, lightAgent);
        (0, vitest_1.expect)(note.is_internal).toBe(true);
        (0, vitest_1.expect)(mockOutbox.recordInTransaction).toHaveBeenCalledWith(mockClient, vitest_1.expect.objectContaining({
            workspaceId: WS_ID,
            conversationId: CONV_ID,
            eventName: 'message:new',
            rooms: [`conversation:${CONV_ID}`],
        }));
    });
    (0, vitest_1.it)('suppresses direct realtime emit when invoked inside realtimeSuppressContext (no double broadcast)', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ id: CONV_ID, visitor_id: 'vis-1' }] });
        mockClient.query
            .mockResolvedValueOnce({
            rows: [
                {
                    id: 'msg-1',
                    conversation_id: CONV_ID,
                    sender_type: 'visitor',
                    sender_id: 'vis-1',
                    content: 'Hi there',
                    is_internal: false,
                },
            ],
        })
            .mockResolvedValueOnce({ rows: [] });
        await realtime_emit_context_1.realtimeSuppressContext.run({ suppressDirectEmit: true }, () => service.sendMessage(WS_ID, CONV_ID, { content: 'Hi there', senderType: 'visitor' }));
        (0, vitest_1.expect)(mockOutbox.recordInTransaction).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(mockRealtime.emitToConversation).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('prevents non-admin agent from editing or deleting NULL sender_id AI/system messages', async () => {
        mockDb.query
            .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
            .mockResolvedValueOnce({ rows: [{ id: 'ai-msg-1', sender_id: null, sender_type: 'ai' }] });
        const regularAgent = {
            id: AGENT_ID,
            email: 'ag@example.com',
            role: 'agent',
            workspaceId: WS_ID,
        };
        await (0, vitest_1.expect)(service.editMessage(WS_ID, CONV_ID, 'ai-msg-1', { content: 'Edited' }, regularAgent)).rejects.toThrow(common_1.ForbiddenException);
        mockDb.query
            .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
            .mockResolvedValueOnce({ rows: [{ id: 'ai-msg-1', sender_id: null, sender_type: 'ai' }] });
        await (0, vitest_1.expect)(service.deleteMessage(WS_ID, CONV_ID, 'ai-msg-1', regularAgent)).rejects.toThrow(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=messages.security.spec.js.map