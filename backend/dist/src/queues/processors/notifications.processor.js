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
var NotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const database_service_1 = require("../../database/database.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let NotificationsProcessor = NotificationsProcessor_1 = class NotificationsProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(db, queuesService) {
        super(queuesService);
        this.db = db;
        this.logger = new common_1.Logger(NotificationsProcessor_1.name);
    }
    async process(job) {
        const { workspaceId, template, recipientEmail, subject, context } = job.data;
        this.logger.log(`Dispatching notification [${template}] for workspace ${workspaceId}: "${subject}"`);
        if (this.db) {
            const suppressed = await this.db
                .query(`SELECT 1 FROM public.email_suppressions WHERE workspace_id = $1 AND email = $2 LIMIT 1`, [workspaceId, recipientEmail.toLowerCase()])
                .catch(() => ({ rows: [] }));
            if (suppressed.rows.length > 0) {
                return { sent: false, suppressed: true, template };
            }
        }
        if (this.queuesService) {
            await this.queuesService.enqueueEmailProcessing({
                workspaceId,
                action: 'send_outbound',
                to: recipientEmail,
                subject,
                text: `[${template}] ${subject}`,
                metadata: { template, context },
                idempotencyKey: job.data.idempotencyKey ? `email-${job.data.idempotencyKey}` : undefined,
            });
        }
        return {
            queuedForDelivery: true,
            template,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.NotificationsProcessor = NotificationsProcessor;
exports.NotificationsProcessor = NotificationsProcessor = NotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_NOTIFICATIONS, {
        concurrency: 10,
        lockDuration: 20_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        queues_service_1.QueuesService])
], NotificationsProcessor);
//# sourceMappingURL=notifications.processor.js.map