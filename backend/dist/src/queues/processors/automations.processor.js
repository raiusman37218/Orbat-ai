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
var AutomationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const database_service_1 = require("../../database/database.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let AutomationsProcessor = AutomationsProcessor_1 = class AutomationsProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(db, queuesService) {
        super(queuesService);
        this.db = db;
        this.logger = new common_1.Logger(AutomationsProcessor_1.name);
    }
    async process(job) {
        const { action, workspaceId, targetId, inactivityMinutes } = job.data;
        this.logger.log(`Executing automation job ${job.id} (${action}) for workspace ${workspaceId}`);
        if (!this.db) {
            return { action, skipped: true, reason: 'database_unavailable' };
        }
        switch (action) {
            case 'check_sla': {
                const res = await this.db.query(`SELECT id
           FROM public.conversations
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND first_agent_reply_at IS NULL
             AND created_at < now() - interval '15 minutes'
           LIMIT 100`, [workspaceId]);
                return { action, checked: true, breachedCount: res.rows.length, conversationIds: res.rows.map((r) => r.id) };
            }
            case 'auto_close_inactive': {
                const mins = Math.min(Math.max(5, Number(inactivityMinutes || 1440)), 43200);
                const res = await this.db.query(`UPDATE public.conversations
           SET status = 'closed', closed_at = now(), updated_at = now()
           WHERE workspace_id = $1
             AND status IN ('open', 'pending')
             AND updated_at < now() - ($2 || ' minutes')::interval
           RETURNING id`, [workspaceId, String(mins)]);
                return { action, closedCount: res.rows.length };
            }
            case 'run_macro': {
                if (!targetId) {
                    return { action, executed: false, reason: 'missing_targetId' };
                }
                return { action, targetId, executed: true };
            }
            default:
                return { action, executed: false, reason: 'unsupported_action' };
        }
    }
};
exports.AutomationsProcessor = AutomationsProcessor;
exports.AutomationsProcessor = AutomationsProcessor = AutomationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_AUTOMATIONS, {
        concurrency: 5,
        lockDuration: 30_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        queues_service_1.QueuesService])
], AutomationsProcessor);
//# sourceMappingURL=automations.processor.js.map