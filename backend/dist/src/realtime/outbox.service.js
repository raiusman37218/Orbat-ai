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
var OutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const realtime_service_1 = require("./realtime.service");
let OutboxService = OutboxService_1 = class OutboxService {
    constructor(db, realtime) {
        this.db = db;
        this.realtime = realtime;
        this.logger = new common_1.Logger(OutboxService_1.name);
    }
    async recordInTransaction(client, input) {
        try {
            const res = await client.query(`INSERT INTO public.realtime_outbox (
           workspace_id, conversation_id, event_name, rooms, payload, status, next_retry_at
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', now())
         RETURNING id`, [
                input.workspaceId,
                input.conversationId || null,
                input.eventName,
                input.rooms,
                JSON.stringify(input.payload),
            ]);
            return res.rows[0]?.id || null;
        }
        catch (err) {
            if (err?.code === '42P01') {
                this.logger.warn('realtime_outbox table missing; apply migration 20261127090000_architecture_hardening.sql');
                return null;
            }
            throw err;
        }
    }
    async markPublished(id) {
        if (!id)
            return;
        await this.db.query(`UPDATE public.realtime_outbox
       SET status = 'published', published_at = now(), updated_at = now()
       WHERE id = $1`, [id]);
    }
    async relayPendingEvents(batchSize = 50) {
        if (!this.realtime || !this.realtime.isReady())
            return { relayed: 0, failed: 0 };
        const rows = await this.db.transaction(async (client) => {
            try {
                const res = await client.query(`WITH claimed AS (
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
           RETURNING o.id, o.workspace_id, o.conversation_id, o.event_name, o.rooms, o.payload, o.attempts`, [batchSize]);
                return res.rows;
            }
            catch (err) {
                if (err?.code === '42P01')
                    return [];
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
                        emitted = this.realtime.emitToConversation(room.slice('conversation:'.length), row.event_name, row.payload) || emitted;
                    }
                    else if (room.startsWith('workspace:')) {
                        emitted = this.realtime.emitToWorkspace(room.slice('workspace:'.length), row.event_name, row.payload) || emitted;
                    }
                    else if (room.startsWith('user:')) {
                        emitted = this.realtime.emitToUser(room.slice('user:'.length), row.event_name, row.payload) || emitted;
                    }
                }
                if (emitted) {
                    await this.markPublished(row.id);
                    relayed++;
                }
                else {
                    const delaySec = Math.min(300, Math.pow(2, row.attempts || 1));
                    await this.db.query(`UPDATE public.realtime_outbox
             SET status = 'failed',
                 last_error = 'Socket.IO server unavailable',
                 next_retry_at = now() + ($2 || ' seconds')::interval,
                 updated_at = now()
             WHERE id = $1`, [row.id, String(delaySec)]);
                    failed++;
                }
            }
            catch (err) {
                const delaySec = Math.min(300, Math.pow(2, row.attempts || 1));
                await this.db.query(`UPDATE public.realtime_outbox
           SET status = $3,
               last_error = $4,
               next_retry_at = now() + ($2 || ' seconds')::interval,
               updated_at = now()
           WHERE id = $1`, [
                    row.id,
                    String(delaySec),
                    (row.attempts || 1) >= 8 ? 'dead_letter' : 'failed',
                    String(err?.message || err).slice(0, 500),
                ]);
                failed++;
            }
        }
        return { relayed, failed };
    }
};
exports.OutboxService = OutboxService;
exports.OutboxService = OutboxService = OutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => realtime_service_1.RealtimeService))),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        realtime_service_1.RealtimeService])
], OutboxService);
//# sourceMappingURL=outbox.service.js.map