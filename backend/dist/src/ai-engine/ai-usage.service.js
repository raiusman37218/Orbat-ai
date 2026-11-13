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
var AiUsageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiUsageService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let AiUsageService = AiUsageService_1 = class AiUsageService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(AiUsageService_1.name);
    }
    async recordTokenUsage(record) {
        const totalTokens = record.promptTokens + record.completionTokens;
        await this.db.query(`INSERT INTO public.ai_token_logs (
         workspace_id, conversation_id, bot_message_id, provider, model,
         purpose, prompt_tokens, completion_tokens, total_tokens,
         cost_usd, is_billable_reply, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
            record.workspaceId,
            record.conversationId || null,
            record.botMessageId || null,
            record.provider,
            record.model,
            record.purpose,
            record.promptTokens,
            record.completionTokens,
            totalTokens,
            record.costUsd,
            Boolean(record.isBillableReply),
            JSON.stringify(record.metadata || {}),
        ]);
    }
    async recordBillableReply(workspaceId, conversationId, botMessageId) {
        await this.db.query(`INSERT INTO public.workspace_usage (
         workspace_id, period_start, period_end, ai_bot_replies_count, updated_at
       )
       VALUES (
         $1,
         date_trunc('month', now()),
         date_trunc('month', now()) + interval '1 month',
         1,
         now()
       )
       ON CONFLICT (workspace_id, period_start)
       DO UPDATE SET
         ai_bot_replies_count = public.workspace_usage.ai_bot_replies_count + 1,
         updated_at = now()`, [workspaceId]);
        await this.db.query(`UPDATE public.ai_token_logs
       SET is_billable_reply = true
       WHERE bot_message_id = $1 AND workspace_id = $2`, [botMessageId, workspaceId]);
        this.logger.log(`Billable AI reply accounted for workspace ${workspaceId} (Message: ${botMessageId})`);
    }
    async checkQuota(workspaceId) {
        const usageRes = await this.db.query(`SELECT COALESCE(ai_bot_replies_count, 0) as used
       FROM public.workspace_usage
       WHERE workspace_id = $1
         AND period_start <= now()
         AND period_end > now()
       ORDER BY period_start DESC
       LIMIT 1`, [workspaceId]);
        const used = Number(usageRes.rows[0]?.used || 0);
        const planRes = await this.db.query(`SELECT p.features
       FROM public.workspace_subscriptions s
       JOIN public.platform_plans p ON p.id = s.plan_id
       WHERE s.workspace_id = $1 AND s.status = 'active'
       LIMIT 1`, [workspaceId]);
        const planLimit = planRes.rows[0]?.features?.max_ai_replies || 5000;
        return {
            allowed: used < planLimit,
            used,
            limit: planLimit,
        };
    }
    async getWorkspaceAiMetrics(workspaceId) {
        const res = await this.db.query(`SELECT
         COUNT(*) as total_calls,
         COUNT(*) FILTER (WHERE is_billable_reply = true) as billable_replies,
         COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
         COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
         COALESCE(SUM(total_tokens), 0) as total_tokens,
         COALESCE(SUM(cost_usd), 0.0) as total_cost_usd
       FROM public.ai_token_logs
       WHERE workspace_id = $1`, [workspaceId]);
        const row = res.rows[0];
        return {
            totalCalls: Number(row.total_calls || 0),
            billableReplies: Number(row.billable_replies || 0),
            totalPromptTokens: Number(row.total_prompt_tokens || 0),
            totalCompletionTokens: Number(row.total_completion_tokens || 0),
            totalTokens: Number(row.total_tokens || 0),
            totalCostUsd: Number(Number(row.total_cost_usd || 0).toFixed(6)),
        };
    }
};
exports.AiUsageService = AiUsageService;
exports.AiUsageService = AiUsageService = AiUsageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AiUsageService);
//# sourceMappingURL=ai-usage.service.js.map