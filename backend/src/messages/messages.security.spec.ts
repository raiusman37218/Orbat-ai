import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { realtimeSuppressContext } from '../realtime/realtime-emit.context';

describe('MessagesService Security, Pagination & Outbox', () => {
  let service: MessagesService;
  let mockDb: any;
  let mockClient: any;
  let mockRealtime: any;
  let mockOutbox: any;

  const WS_ID = '11111111-1111-4111-8111-111111111111';
  const CONV_ID = '22222222-2222-4222-8222-222222222222';
  const AGENT_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    mockClient = { query: vi.fn() };
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (cb: (client: any) => Promise<any>) => cb(mockClient)),
    };
    mockRealtime = {
      emitToConversation: vi.fn().mockReturnValue(true),
      emitToWorkspace: vi.fn().mockReturnValue(true),
    };
    mockOutbox = {
      recordInTransaction: vi.fn().mockResolvedValue('outbox-1'),
      markPublished: vi.fn().mockResolvedValue(undefined),
    };
    service = new MessagesService(mockDb, mockRealtime, mockOutbox);
  });

  it('fetches newest N messages via INNER ORDER BY DESC LIMIT and clamps limit to 100', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: 'm1' }, { id: 'm2' }] });

    await service.getMessages(WS_ID, CONV_ID, 500);

    const [sql, params] = mockDb.query.mock.calls[1];
    expect(sql).toContain('ORDER BY m.created_at DESC');
    expect(sql).toContain('ORDER BY latest.created_at ASC');
    expect(params).toEqual([CONV_ID, 100]);
  });

  it('blocks light_agent from sending public messages, allows internal notes', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: CONV_ID, visitor_id: 'vis-1' }] });
    const lightAgent: any = {
      id: AGENT_ID,
      email: 'light@example.com',
      name: 'Light',
      role: 'light_agent',
      workspaceId: WS_ID,
    };

    await expect(
      service.sendMessage(WS_ID, CONV_ID, { content: 'Public reply', isInternal: false }, lightAgent),
    ).rejects.toThrow(ForbiddenException);

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

    const note = await service.sendMessage(
      WS_ID,
      CONV_ID,
      { content: 'Internal note', isInternal: true },
      lightAgent,
    );
    expect(note.is_internal).toBe(true);
    expect(mockOutbox.recordInTransaction).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        workspaceId: WS_ID,
        conversationId: CONV_ID,
        eventName: 'message:new',
        rooms: [`conversation:${CONV_ID}`],
      }),
    );
  });

  it('suppresses direct realtime emit when invoked inside realtimeSuppressContext (no double broadcast)', async () => {
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

    await realtimeSuppressContext.run({ suppressDirectEmit: true }, () =>
      service.sendMessage(WS_ID, CONV_ID, { content: 'Hi there', senderType: 'visitor' }),
    );

    expect(mockOutbox.recordInTransaction).toHaveBeenCalledTimes(1);
    expect(mockRealtime.emitToConversation).not.toHaveBeenCalled();
  });

  it('prevents non-admin agent from editing or deleting NULL sender_id AI/system messages', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ai-msg-1', sender_id: null, sender_type: 'ai' }] });

    const regularAgent: any = {
      id: AGENT_ID,
      email: 'ag@example.com',
      role: 'agent',
      workspaceId: WS_ID,
    };

    await expect(
      service.editMessage(WS_ID, CONV_ID, 'ai-msg-1', { content: 'Edited' }, regularAgent),
    ).rejects.toThrow(ForbiddenException);

    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: CONV_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ai-msg-1', sender_id: null, sender_type: 'ai' }] });

    await expect(
      service.deleteMessage(WS_ID, CONV_ID, 'ai-msg-1', regularAgent),
    ).rejects.toThrow(ForbiddenException);
  });
});
