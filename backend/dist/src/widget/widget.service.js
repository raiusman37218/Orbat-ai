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
var WidgetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const realtime_service_1 = require("../realtime/realtime.service");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let WidgetService = WidgetService_1 = class WidgetService {
    constructor(db, realtime) {
        this.db = db;
        this.realtime = realtime;
        this.logger = new common_1.Logger(WidgetService_1.name);
    }
    assertUuid(value, field) {
        const str = String(value ?? '').trim();
        if (!UUID_REGEX.test(str)) {
            throw new common_1.BadRequestException(`Invalid UUID for ${field}.`);
        }
        return str;
    }
    assertToken(value) {
        const str = String(value ?? '').trim();
        if (!str) {
            throw new common_1.UnauthorizedException('Missing visitor session token.');
        }
        return str;
    }
    mapPgError(error) {
        const code = error?.code;
        const message = String(error?.message || 'Widget database operation failed');
        if (code === '28000' || message.includes('visitor_session_invalid')) {
            throw new common_1.UnauthorizedException(message);
        }
        if (code === 'P0002' || message.includes('not_found') || message.includes('workspace_unavailable')) {
            throw new common_1.NotFoundException(message);
        }
        if (code === 'P0001' || message.includes('rate_limited')) {
            throw new common_1.HttpException('Rate limit exceeded. Please wait a moment.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (code === '22023' || code === '22001' || code === '22P02') {
            throw new common_1.BadRequestException(message);
        }
        throw error;
    }
    async runRpc(sql, params) {
        try {
            const res = await this.db.query(sql, params);
            return res.rows[0]?.data;
        }
        catch (error) {
            this.mapPgError(error);
        }
    }
    async emitConversationEvent(conversationId, event, data) {
        try {
            const res = await this.db.query('SELECT workspace_id FROM public.conversations WHERE id = $1 LIMIT 1', [conversationId]);
            const workspaceId = res.rows[0]?.workspace_id;
            this.realtime?.emitToConversation(conversationId, event, data);
            if (workspaceId) {
                this.realtime?.emitToWorkspace(workspaceId, event, data);
            }
            return workspaceId;
        }
        catch (err) {
            this.logger.warn(`Realtime broadcast lookup failed for conversation ${conversationId}: ${String(err)}`);
            return undefined;
        }
    }
    async getConfig(workspaceId) {
        const wsId = this.assertUuid(workspaceId, 'workspaceId');
        const data = await this.runRpc('SELECT public.fn_get_workspace_config($1::uuid) AS data', [wsId]);
        if (!data) {
            throw new common_1.NotFoundException('Workspace not found or unavailable.');
        }
        return data;
    }
    async getAgents(workspaceId) {
        const wsId = this.assertUuid(workspaceId, 'workspaceId');
        return this.runRpc('SELECT public.fn_widget_agents($1::uuid) AS data', [wsId]);
    }
    async getHelp(workspaceId) {
        const wsId = this.assertUuid(workspaceId, 'workspaceId');
        const [secRes, artRes] = await Promise.all([
            this.db.query(`SELECT id, name, description, icon, order_index
         FROM public.help_sections
         WHERE workspace_id = $1
         ORDER BY order_index ASC, created_at ASC`, [wsId]),
            this.db.query(`SELECT a.id, a.title, a.slug, a.summary, a.content, a.category, a.section_id, a.order_index,
                CASE WHEN s.id IS NOT NULL THEN jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon) ELSE NULL END AS section
         FROM public.articles a
         LEFT JOIN public.help_sections s ON s.id = a.section_id
         WHERE a.workspace_id = $1 AND a.status = 'published'
         ORDER BY a.order_index ASC, a.created_at ASC`, [wsId]),
        ]);
        return {
            sections: secRes.rows,
            articles: artRes.rows,
        };
    }
    async createOrVerifySession(body) {
        const wsId = this.assertUuid(body.workspaceId ?? body.p_workspace_id, 'workspaceId');
        const visitorId = this.assertUuid(body.visitorId ?? body.p_visitor_id, 'visitorId');
        const token = body.token ?? body.p_token ?? null;
        return this.runRpc('SELECT public.fn_widget_session($1::uuid, $2::uuid, $3::text) AS data', [wsId, visitorId, token]);
    }
    async listConversations(visitorId, token) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        return this.runRpc('SELECT public.fn_widget_conversations($1::uuid, $2::text) AS data', [vId, t]);
    }
    async startConversation(visitorId, token, forceNew = false) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const conv = await this.runRpc('SELECT public.fn_widget_start_conversation($1::uuid, $2::text, $3::boolean) AS data', [vId, t, Boolean(forceNew)]);
        if (conv?.id) {
            await this.emitConversationEvent(conv.id, 'conversation:created', conv);
        }
        return conv;
    }
    async getMessages(visitorId, token, conversationId) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        return this.runRpc('SELECT public.fn_widget_messages($1::uuid, $2::text, $3::uuid) AS data', [vId, t, convId]);
    }
    async sendMessage(visitorId, token, conversationId, content, attachmentUrl) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        const cleanedUrl = attachmentUrl ? String(attachmentUrl).trim() : null;
        let msg;
        if (cleanedUrl && !/^https:\/\//i.test(cleanedUrl) && (/^\//.test(cleanedUrl) || /^http:\/\//i.test(cleanedUrl))) {
            try {
                await this.db.query('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
                const convRes = await this.db.query('SELECT * FROM public.fn_widget_conversation($1::uuid, $2::uuid)', [vId, convId]);
                const conv = convRes.rows[0];
                if (!conv?.id) {
                    throw new common_1.NotFoundException('Conversation not found.');
                }
                const trimmedContent = (content || '').trim() || 'Sent a picture';
                if (conv.status !== 'open') {
                    await this.db.query(`UPDATE public.conversations
             SET status = 'open', closed_at = NULL, snoozed_until = NULL, updated_at = now()
             WHERE id = $1`, [conv.id]);
                }
                const ins = await this.db.query(`INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, attachment_url, is_internal, created_at)
           VALUES ($1, 'visitor', $2, $3, $4, false, clock_timestamp())
           RETURNING *`, [conv.id, vId, trimmedContent, cleanedUrl]);
                const jsonRes = await this.db.query('SELECT public.fn_widget_message_json($1::public.messages) AS data', [ins.rows[0]]).catch(() => ({ rows: [{ data: ins.rows[0] }] }));
                msg = jsonRes.rows[0]?.data || ins.rows[0];
            }
            catch (error) {
                this.mapPgError(error);
            }
        }
        else {
            msg = await this.runRpc('SELECT public.fn_widget_send_message($1::uuid, $2::text, $3::uuid, $4::text, $5::text) AS data', [vId, t, convId, content || '', cleanedUrl]);
        }
        const wsId = await this.emitConversationEvent(convId, 'message:new', msg);
        if (wsId) {
            this.realtime?.emitToWorkspace(wsId, 'conversation:updated', {
                conversationId: convId,
                lastMessage: msg,
            });
        }
        return msg;
    }
    async heartbeat(visitorId, token, body) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        await this.runRpc('SELECT public.fn_widget_heartbeat($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data', [
            vId,
            t,
            body.currentUrl ?? body.p_current_url ?? null,
            body.pageTitle ?? body.p_page_title ?? null,
            body.referrer ?? body.p_referrer ?? null,
            body.timeOnPage ?? body.p_time_on_page ?? null,
        ]);
        return { ok: true };
    }
    async recordPage(visitorId, token, body) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        await this.runRpc('SELECT public.fn_widget_record_page($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data', [
            vId,
            t,
            body.url ?? body.p_url ?? '',
            body.title ?? body.p_title ?? null,
            body.referrer ?? body.p_referrer ?? null,
            Number(body.durationSeconds ?? body.p_duration_seconds ?? 0),
        ]);
        return { ok: true };
    }
    async updateMeta(visitorId, token, body) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        await this.runRpc('SELECT public.fn_widget_update_meta($1::uuid, $2::text, $3::text, $4::text) AS data', [
            vId,
            t,
            body.timezone ?? body.p_timezone ?? null,
            body.language ?? body.p_language ?? null,
        ]);
        return { ok: true };
    }
    async updateVisitor(visitorId, token, body) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        await this.runRpc('SELECT public.fn_widget_update_visitor($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text) AS data', [
            vId,
            t,
            body.name ?? body.p_name ?? null,
            body.email ?? body.p_email ?? null,
            body.currentUrl ?? body.p_current_url ?? null,
            body.userAgent ?? body.p_user_agent ?? null,
            body.location ?? body.p_location ?? null,
        ]);
        return { ok: true };
    }
    async markOffline(visitorId, token) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        await this.runRpc('SELECT public.fn_widget_offline($1::uuid, $2::text) AS data', [vId, t]);
        return { ok: true };
    }
    async markMessages(visitorId, token, conversationId, read = true) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        await this.runRpc('SELECT public.fn_widget_mark($1::uuid, $2::text, $3::uuid, $4::boolean) AS data', [vId, t, convId, Boolean(read)]);
        if (read) {
            this.realtime?.emitToConversation(convId, 'message:read', {
                conversationId: convId,
                readBy: 'visitor',
                readAt: new Date().toISOString(),
            });
        }
        return { ok: true };
    }
    async requestHandoff(visitorId, token, conversationId, reason) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        const data = await this.runRpc('SELECT public.fn_widget_request_handoff($1::uuid, $2::text, $3::uuid, $4::text) AS data', [vId, t, convId, reason ?? null]);
        await this.emitConversationEvent(convId, 'conversation:updated', {
            conversationId: convId,
            ...(data || {}),
        });
        return data;
    }
    async setAiAssist(visitorId, token, conversationId, enabled = true) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        return this.runRpc('SELECT public.fn_widget_set_ai_assist($1::uuid, $2::text, $3::uuid, $4::boolean) AS data', [vId, t, convId, Boolean(enabled)]);
    }
    async setTopic(visitorId, token, conversationId, topic) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        return this.runRpc('SELECT public.fn_widget_set_topic($1::uuid, $2::text, $3::uuid, $4::text) AS data', [vId, t, convId, String(topic ?? '')]);
    }
    async markResolved(visitorId, token, conversationId) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        const data = await this.runRpc('SELECT public.fn_widget_mark_resolved($1::uuid, $2::text, $3::uuid) AS data', [vId, t, convId]);
        await this.emitConversationEvent(convId, 'conversation:updated', {
            conversationId: convId,
            ...(data || {}),
        });
        return data;
    }
    async saveWelcome(visitorId, token, conversationId, content) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        return this.runRpc('SELECT public.fn_widget_welcome($1::uuid, $2::text, $3::uuid, $4::text) AS data', [vId, t, convId, String(content ?? '')]);
    }
    async submitCsat(visitorId, token, conversationId, rating, feedback) {
        const vId = this.assertUuid(visitorId, 'visitorId');
        const t = this.assertToken(token);
        const convId = this.assertUuid(conversationId, 'conversationId');
        const numericRating = Number(rating);
        if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            throw new common_1.BadRequestException('CSAT rating must be an integer between 1 and 5.');
        }
        try {
            await this.db.query('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
            const convRes = await this.db.query('SELECT id FROM public.conversations WHERE id = $1 AND visitor_id = $2 LIMIT 1', [convId, vId]);
            if (convRes.rows.length === 0) {
                throw new common_1.NotFoundException('Conversation not found.');
            }
            const upd = await this.db.query(`UPDATE public.conversations
         SET csat_rating = $1,
             csat_feedback = $2,
             updated_at = now()
         WHERE id = $3
         RETURNING id, csat_rating, csat_feedback`, [numericRating, feedback ? String(feedback).trim().slice(0, 1000) : null, convId]);
            await this.emitConversationEvent(convId, 'conversation:updated', {
                conversationId: convId,
                csat_rating: numericRating,
            });
            return upd.rows[0];
        }
        catch (error) {
            this.mapPgError(error);
        }
    }
    async invokeWhitelistedRpc(fnName, body) {
        switch (fnName) {
            case 'fn_get_workspace_config':
                return this.getConfig(body.p_workspace_id ?? body.workspaceId);
            case 'fn_widget_agents':
                return this.getAgents(body.p_workspace_id ?? body.workspaceId);
            case 'fn_widget_session':
                return this.createOrVerifySession(body);
            case 'fn_widget_conversations':
                return this.listConversations(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token);
            case 'fn_widget_start_conversation':
                return this.startConversation(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, Boolean(body.p_force_new ?? body.forceNew));
            case 'fn_widget_messages':
                return this.getMessages(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId);
            case 'fn_widget_send_message':
                return this.sendMessage(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_content ?? body.content ?? '', body.p_attachment_url ?? body.attachmentUrl ?? null);
            case 'fn_widget_heartbeat':
                return this.heartbeat(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body);
            case 'fn_widget_record_page':
                return this.recordPage(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body);
            case 'fn_widget_update_meta':
                return this.updateMeta(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body);
            case 'fn_widget_update_visitor':
                return this.updateVisitor(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body);
            case 'fn_widget_offline':
                return this.markOffline(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token);
            case 'fn_widget_mark':
                return this.markMessages(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_read ?? body.read ?? true);
            case 'fn_widget_request_handoff':
                return this.requestHandoff(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_reason ?? body.reason ?? null);
            case 'fn_widget_set_ai_assist':
                return this.setAiAssist(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_enabled ?? body.enabled ?? true);
            case 'fn_widget_set_topic':
                return this.setTopic(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_topic ?? body.topic ?? '');
            case 'fn_widget_mark_resolved':
                return this.markResolved(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId);
            case 'fn_widget_welcome':
                return this.saveWelcome(body.p_visitor_id ?? body.visitorId, body.p_token ?? body.token, body.p_conversation_id ?? body.conversationId, body.p_content ?? body.content ?? '');
            case 'fn_submit_article_feedback': {
                const articleId = this.assertUuid(body.p_article_id ?? body.articleId, 'articleId');
                const wsId = this.assertUuid(body.p_workspace_id ?? body.workspaceId, 'workspaceId');
                const visitorId = String(body.p_visitor_id ?? body.visitorId ?? '');
                const isHelpful = Boolean(body.p_is_helpful ?? body.isHelpful);
                const feedbackText = body.p_feedback_text ?? body.feedbackText ?? null;
                return this.runRpc('SELECT public.fn_submit_article_feedback($1::uuid, $2::uuid, $3::text, $4::boolean, $5::text) AS data', [articleId, wsId, visitorId, isHelpful, feedbackText]);
            }
            default:
                throw new common_1.BadRequestException(`Unsupported widget RPC function: ${fnName}`);
        }
    }
};
exports.WidgetService = WidgetService;
exports.WidgetService = WidgetService = WidgetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => realtime_service_1.RealtimeService))),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        realtime_service_1.RealtimeService])
], WidgetService);
//# sourceMappingURL=widget.service.js.map