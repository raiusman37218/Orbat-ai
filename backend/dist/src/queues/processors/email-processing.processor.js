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
var EmailProcessingProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const database_service_1 = require("../../database/database.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let EmailProcessingProcessor = EmailProcessingProcessor_1 = class EmailProcessingProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(db, queuesService) {
        super(queuesService);
        this.db = db;
        this.logger = new common_1.Logger(EmailProcessingProcessor_1.name);
    }
    async process(job) {
        const { workspaceId, action, to, subject, rawEmailId } = job.data;
        if (action === 'process_inbound') {
            if (this.db && rawEmailId) {
                const res = await this.db.query(`SELECT id FROM public.email_inbound_log WHERE id = $1 AND workspace_id = $2 LIMIT 1`, [rawEmailId, workspaceId]);
                return { processed: res.rows.length > 0, rawEmailId };
            }
            return { processed: true, action };
        }
        if (!to) {
            return { sent: false, reason: 'missing_recipient' };
        }
        if (this.db) {
            const suppressed = await this.db
                .query('SELECT 1 FROM public.email_suppressions WHERE workspace_id = $1 AND email = $2 LIMIT 1', [workspaceId, to.toLowerCase()])
                .catch(() => ({ rows: [] }));
            if (suppressed.rows.length > 0) {
                return { sent: false, reason: 'suppressed_recipient' };
            }
        }
        const relayUrl = process.env.INTERNAL_EMAIL_RELAY_URL;
        const internalToken = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
        if (relayUrl && internalToken) {
            const res = await fetch(relayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': internalToken,
                },
                body: JSON.stringify(job.data),
                signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) {
                throw new Error(`Email relay HTTP ${res.status}`);
            }
            return { sent: true, via: 'internal_relay' };
        }
        this.logger.log(`Recorded outbound email job ${job.id} (${subject || 'Notification'}) for workspace ${workspaceId}`);
        return { sent: false, reason: 'smtp_relay_not_configured' };
    }
};
exports.EmailProcessingProcessor = EmailProcessingProcessor;
exports.EmailProcessingProcessor = EmailProcessingProcessor = EmailProcessingProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_EMAIL_PROCESSING, {
        concurrency: 5,
        lockDuration: 30_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        queues_service_1.QueuesService])
], EmailProcessingProcessor);
//# sourceMappingURL=email-processing.processor.js.map