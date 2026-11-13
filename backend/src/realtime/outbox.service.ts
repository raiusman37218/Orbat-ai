import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from './realtime.service';

export interface OutboxEventInput {
  workspaceId: string;
  conversationId?: string | null;
  eventName: string;
  rooms: string[];
  payload: Record<string, any>;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional()
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtime?: RealtimeService,
  ) {}

  async recordInTransaction(
    client: PoolClient,
    input: OutboxEventInput,
  ): Promise<string | null> {
    try {
      const res = await client.query(
        `INSERT INTO public.realtime_outbox (
           workspace_id, conversation_id, event_name, rooms, payload, status, next_retry_at
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', now())
         RETURNING id`,
        [
          input.workspaceId,
          input.conversationId || null,
          input.eventName,
          input.rooms,
          JSON.stringify(input.payload),
        ],
      );
      return res.rows[0]?.id || null;
    } catch (err: any) {
      // If migration 20261127090000 has not been applied yet, surface clear warning once without corrupting transaction
      if (err?.code === '42P01') {
        this.logger.warn('realtime_outbox table missing; apply migration 20261127090000_architecture_hardening.sql');
        return null;
      }
      throw err;
    }
  }

  async markPublished(id: string): Promise<void> {
    if (!id) return;
    await this.db.query(
      `UPDATE public.realtime_outbox
       SET status = 'published', published_at = now(), updated_at = now()
       WHERE id = $1`,
      [id],
    );
  }

  async relayPendingEvents(batchSize = 50): Promise<{ relayed: number; failed: number }> {
    if (!this.realtime || !this.realtime.isReady()) return { relayed: 0, failed: 0 };

    const rows = await this.db.transaction(async (client) => {
      try {
        const res = await client.query(
          `WITH claimed AS (
             SELECT id
             FROM public.realtime_outbox
             WHERE status IN ('pending', 'failed')
               AND next_retry_at <= now()
               AND attempts < 8
             ORDER BY created_at ASC
             LIMIT $1
             FOR UPDATE SKIP LOCKED
           )
           UPDATE public.realtime_outbox o
           SET status = 'processing', attempts = o.attempts + 1, updated_at = now()
           FROM claimed
           WHERE o.id = claimed.id
           RETURNING o.id, o.workspace_id, o.conversation_id, o.event_name, o.rooms, o.payload, o.attempts`,
          [batchSize],
        );
        return res.rows;
      } catch (err: any) {
        if (err?.code === '42P01') return [];
        throw err;
      }
    });

    let relayed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        let emitted = false;
        for (const room of row.rooms || []) {
          if (room.startsWith('conversation:')) {
            emitted = this.realtime.emitToConversation(
              room.slice('conversation:'.length),
              row.event_name,
              row.payload,
            ) || emitted;
          } else if (room.startsWith('workspace:')) {
            emitted = this.realtime.emitToWorkspace(
              room.slice('workspace:'.length),
              row.event_name,
              row.payload,
            ) || emitted;
          } else if (room.startsWith('user:')) {
            emitted = this.realtime.emitToUser(
              room.slice('user:'.length),
              row.event_name,
              row.payload,
            ) || emitted;
          }
        }

        if (emitted) {
          await this.markPublished(row.id);
          relayed++;
        } else {
          const delaySec = Math.min(300, Math.pow(2, row.attempts || 1));
          await this.db.query(
            `UPDATE public.realtime_outbox
             SET status = 'failed',
                 last_error = 'Socket.IO server unavailable',
                 next_retry_at = now() + ($2 || ' seconds')::interval,
                 updated_at = now()
             WHERE id = $1`,
            [row.id, String(delaySec)],
          );
          failed++;
        }
      } catch (err: any) {
        const delaySec = Math.min(300, Math.pow(2, row.attempts || 1));
        await this.db.query(
          `UPDATE public.realtime_outbox
           SET status = $3,
               last_error = $4,
               next_retry_at = now() + ($2 || ' seconds')::interval,
               updated_at = now()
           WHERE id = $1`,
          [
            row.id,
            String(delaySec),
            (row.attempts || 1) >= 8 ? 'dead_letter' : 'failed',
            String(err?.message || err).slice(0, 500),
          ],
        );
        failed++;
      }
    }

    return { relayed, failed };
  }
}
