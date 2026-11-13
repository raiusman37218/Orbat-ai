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
var AnalyticsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const database_service_1 = require("../../database/database.service");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
let AnalyticsProcessor = AnalyticsProcessor_1 = class AnalyticsProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(db, queuesService) {
        super(queuesService);
        this.db = db;
        this.logger = new common_1.Logger(AnalyticsProcessor_1.name);
    }
    async process(job) {
        const { workspaceId, eventType } = job.data;
        if (!this.db) {
            return { workspaceId, eventType, skipped: true };
        }
        const summary = await this.db.query(`SELECT
         COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
         COUNT(*) FILTER (WHERE ai_enabled = true)::int AS ai_handled_count
       FROM public.conversations
       WHERE workspace_id = $1`, [workspaceId]);
        const row = summary.rows[0] || {};
        this.logger.log(`Analytics rollup (${eventType}) completed for workspace ${workspaceId}`);
        return { workspaceId, eventType, metrics: row };
    }
};
exports.AnalyticsProcessor = AnalyticsProcessor;
exports.AnalyticsProcessor = AnalyticsProcessor = AnalyticsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_ANALYTICS, {
        concurrency: 3,
        lockDuration: 30_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        queues_service_1.QueuesService])
], AnalyticsProcessor);
//# sourceMappingURL=analytics.processor.js.map