import {
  Injectable,
  Inject,
  Optional,
  forwardRef,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional()
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtime?: RealtimeService,
  ) {}

  private assertUuid(value: unknown, field: string): string {
    const str = String(value ?? '').trim();
    if (!UUID_REGEX.test(str)) {
      throw new BadRequestException(`Invalid UUID for ${field}.`);
    }
    return str;
  }

  private assertToken(value: unknown): string {
    const str = String(value ?? '').trim();
    if (!str) {
      throw new UnauthorizedException('Missing visitor session token.');
    }
    return str;
  }

  private mapPgError(error: any): never {
    const code = error?.code;
    const message = String(error?.message || 'Widget database operation failed');

    if (code === '28000' || message.includes('visitor_session_invalid')) {
      throw new UnauthorizedException(message);
    }
    if (code === 'P0002' || message.includes('not_found') || message.includes('workspace_unavailable')) {
      throw new NotFoundException(message);
    }
    if (code === 'P0001' || message.includes('rate_limited')) {
      throw new HttpException('Rate limit exceeded. Please wait a moment.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (code === '22023' || code === '22001' || code === '22P02') {
      throw new BadRequestException(message);
    }
    throw error;
  }

  private async runRpc<T = any>(sql: string, params: any[]): Promise<T> {
    try {
      const res = await this.db.query(sql, params);
      return res.rows[0]?.data as T;
    } catch (error) {
      this.mapPgError(error);
    }
  }

  private async emitConversationEvent(conversationId: string, event: string, data: any) {
    try {
      const res = await this.db.query(
        'SELECT workspace_id FROM public.conversations WHERE id = $1 LIMIT 1',
        [conversationId],
      );
      const workspaceId = res.rows[0]?.workspace_id;
      this.realtime?.emitToConversation(conversationId, event, data);
      if (workspaceId) {
        this.realtime?.emitToWorkspace(workspaceId, event, data);
      }
      return workspaceId as string | undefined;
    } catch (err) {
      this.logger.warn(`Realtime broadcast lookup failed for conversation ${conversationId}: ${String(err)}`);
      return undefined;
    }
  }

  async getConfig(workspaceId: string) {
    const wsId = this.assertUuid(workspaceId, 'workspaceId');
    const data = await this.runRpc(
      'SELECT public.fn_get_workspace_config($1::uuid) AS data',
      [wsId],
    );
    if (!data) {
      throw new NotFoundException('Workspace not found or unavailable.');
    }
    return data;
  }

  async getAgents(workspaceId: string) {
    const wsId = this.assertUuid(workspaceId, 'workspaceId');
    return this.runRpc(
      'SELECT public.fn_widget_agents($1::uuid) AS data',
      [wsId],
    );
  }

  async createOrVerifySession(body: {
    workspaceId?: string;
    p_workspace_id?: string;
    visitorId?: string;
    p_visitor_id?: string;
    token?: string | null;
    p_token?: string | null;
  }) {
    const wsId = this.assertUuid(body.workspaceId ?? body.p_workspace_id, 'workspaceId');
    const visitorId = this.assertUuid(body.visitorId ?? body.p_visitor_id, 'visitorId');
    const token = body.token ?? body.p_token ?? null;

    return this.runRpc(
      'SELECT public.fn_widget_session($1::uuid, $2::uuid, $3::text) AS data',
      [wsId, visitorId, token],
    );
  }

  async listConversations(visitorId: string, token: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    return this.runRpc(
      'SELECT public.fn_widget_conversations($1::uuid, $2::text) AS data',
      [vId, t],
    );
  }

  async startConversation(visitorId: string, token: string, forceNew = false) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const conv = await this.runRpc(
      'SELECT public.fn_widget_start_conversation($1::uuid, $2::text, $3::boolean) AS data',
      [vId, t, Boolean(forceNew)],
    );
    if (conv?.id) {
      await this.emitConversationEvent(conv.id, 'conversation:created', conv);
    }
    return conv;
  }

  async getMessages(visitorId: string, token: string, conversationId: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    return this.runRpc(
      'SELECT public.fn_widget_messages($1::uuid, $2::text, $3::uuid) AS data',
      [vId, t, convId],
    );
  }

  async sendMessage(
    visitorId: string,
    token: string,
    conversationId: string,
    content: string,
    attachmentUrl?: string | null,
  ) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    const cleanedUrl = attachmentUrl ? String(attachmentUrl).trim() : null;

    let msg: any;
    if (cleanedUrl && !/^https:\/\//i.test(cleanedUrl) && (/^\//.test(cleanedUrl) || /^http:\/\//i.test(cleanedUrl))) {
      // Allow local/relative uploads in dev or HTTP dev setups while keeping strict visitor auth
      try {
        await this.db.query('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
        const convRes = await this.db.query(
          'SELECT * FROM public.fn_widget_conversation($1::uuid, $2::uuid)',
          [vId, convId],
        );
        const conv = convRes.rows[0];
        if (!conv?.id) {
          throw new NotFoundException('Conversation not found.');
        }
        const trimmedContent = (content || '').trim() || 'Sent a picture';
        if (conv.status !== 'open') {
          await this.db.query(
            `UPDATE public.conversations
             SET status = 'open', closed_at = NULL, snoozed_until = NULL, updated_at = now()
             WHERE id = $1`,
            [conv.id],
          );
        }
        const ins = await this.db.query(
          `INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, attachment_url, is_internal, created_at)
           VALUES ($1, 'visitor', $2, $3, $4, false, clock_timestamp())
           RETURNING *`,
          [conv.id, vId, trimmedContent, cleanedUrl],
        );
        const jsonRes = await this.db.query(
          'SELECT public.fn_widget_message_json($1::public.messages) AS data',
          [ins.rows[0]],
        ).catch(() => ({ rows: [{ data: ins.rows[0] }] }));
        msg = jsonRes.rows[0]?.data || ins.rows[0];
      } catch (error) {
        this.mapPgError(error);
      }
    } else {
      msg = await this.runRpc(
        'SELECT public.fn_widget_send_message($1::uuid, $2::text, $3::uuid, $4::text, $5::text) AS data',
        [vId, t, convId, content || '', cleanedUrl],
      );
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

  async heartbeat(visitorId: string, token: string, body: Record<string, any>) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    await this.runRpc(
      'SELECT public.fn_widget_heartbeat($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data',
      [
        vId,
        t,
        body.currentUrl ?? body.p_current_url ?? null,
        body.pageTitle ?? body.p_page_title ?? null,
        body.referrer ?? body.p_referrer ?? null,
        body.timeOnPage ?? body.p_time_on_page ?? null,
      ],
    );
    return { ok: true };
  }

  async recordPage(visitorId: string, token: string, body: Record<string, any>) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    await this.runRpc(
      'SELECT public.fn_widget_record_page($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::integer) AS data',
      [
        vId,
        t,
        body.url ?? body.p_url ?? '',
        body.title ?? body.p_title ?? null,
        body.referrer ?? body.p_referrer ?? null,
        Number(body.durationSeconds ?? body.p_duration_seconds ?? 0),
      ],
    );
    return { ok: true };
  }

  async updateMeta(visitorId: string, token: string, body: Record<string, any>) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    await this.runRpc(
      'SELECT public.fn_widget_update_meta($1::uuid, $2::text, $3::text, $4::text) AS data',
      [
        vId,
        t,
        body.timezone ?? body.p_timezone ?? null,
        body.language ?? body.p_language ?? null,
      ],
    );
    return { ok: true };
  }

  async updateVisitor(visitorId: string, token: string, body: Record<string, any>) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    await this.runRpc(
      'SELECT public.fn_widget_update_visitor($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text) AS data',
      [
        vId,
        t,
        body.name ?? body.p_name ?? null,
        body.email ?? body.p_email ?? null,
        body.currentUrl ?? body.p_current_url ?? null,
        body.userAgent ?? body.p_user_agent ?? null,
        body.location ?? body.p_location ?? null,
      ],
    );
    return { ok: true };
  }

  async markOffline(visitorId: string, token: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    await this.runRpc(
      'SELECT public.fn_widget_offline($1::uuid, $2::text) AS data',
      [vId, t],
    );
    return { ok: true };
  }

  async markMessages(visitorId: string, token: string, conversationId: string, read = true) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    await this.runRpc(
      'SELECT public.fn_widget_mark($1::uuid, $2::text, $3::uuid, $4::boolean) AS data',
      [vId, t, convId, Boolean(read)],
    );
    if (read) {
      this.realtime?.emitToConversation(convId, 'message:read', {
        conversationId: convId,
        readBy: 'visitor',
        readAt: new Date().toISOString(),
      });
    }
    return { ok: true };
  }

  async requestHandoff(visitorId: string, token: string, conversationId: string, reason?: string | null) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    const data = await this.runRpc(
      'SELECT public.fn_widget_request_handoff($1::uuid, $2::text, $3::uuid, $4::text) AS data',
      [vId, t, convId, reason ?? null],
    );
    await this.emitConversationEvent(convId, 'conversation:updated', {
      conversationId: convId,
      ...(data || {}),
    });
    return data;
  }

  async setAiAssist(visitorId: string, token: string, conversationId: string, enabled = true) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    return this.runRpc(
      'SELECT public.fn_widget_set_ai_assist($1::uuid, $2::text, $3::uuid, $4::boolean) AS data',
      [vId, t, convId, Boolean(enabled)],
    );
  }

  async setTopic(visitorId: string, token: string, conversationId: string, topic: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    return this.runRpc(
      'SELECT public.fn_widget_set_topic($1::uuid, $2::text, $3::uuid, $4::text) AS data',
      [vId, t, convId, String(topic ?? '')],
    );
  }

  async markResolved(visitorId: string, token: string, conversationId: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    const data = await this.runRpc(
      'SELECT public.fn_widget_mark_resolved($1::uuid, $2::text, $3::uuid) AS data',
      [vId, t, convId],
    );
    await this.emitConversationEvent(convId, 'conversation:updated', {
      conversationId: convId,
      ...(data || {}),
    });
    return data;
  }

  async saveWelcome(visitorId: string, token: string, conversationId: string, content: string) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    return this.runRpc(
      'SELECT public.fn_widget_welcome($1::uuid, $2::text, $3::uuid, $4::text) AS data',
      [vId, t, convId, String(content ?? '')],
    );
  }

  async submitCsat(
    visitorId: string,
    token: string,
    conversationId: string,
    rating: number,
    feedback?: string | null,
  ) {
    const vId = this.assertUuid(visitorId, 'visitorId');
    const t = this.assertToken(token);
    const convId = this.assertUuid(conversationId, 'conversationId');
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new BadRequestException('CSAT rating must be an integer between 1 and 5.');
    }

    try {
      await this.db.query('SELECT public.fn_widget_auth($1::uuid, $2::text)', [vId, t]);
      const convRes = await this.db.query(
        'SELECT id FROM public.conversations WHERE id = $1 AND visitor_id = $2 LIMIT 1',
        [convId, vId],
      );
      if (convRes.rows.length === 0) {
        throw new NotFoundException('Conversation not found.');
      }

      const upd = await this.db.query(
        `UPDATE public.conversations
         SET csat_rating = $1,
             csat_feedback = $2,
             updated_at = now()
         WHERE id = $3
         RETURNING id, csat_rating, csat_feedback`,
        [numericRating, feedback ? String(feedback).trim().slice(0, 1000) : null, convId],
      );
      await this.emitConversationEvent(convId, 'conversation:updated', {
        conversationId: convId,
        csat_rating: numericRating,
      });
      return upd.rows[0];
    } catch (error) {
      this.mapPgError(error);
    }
  }

  async invokeWhitelistedRpc(fnName: string, body: Record<string, any>) {
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
        return this.startConversation(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          Boolean(body.p_force_new ?? body.forceNew),
        );
      case 'fn_widget_messages':
        return this.getMessages(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
        );
      case 'fn_widget_send_message':
        return this.sendMessage(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_content ?? body.content ?? '',
          body.p_attachment_url ?? body.attachmentUrl ?? null,
        );
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
        return this.markMessages(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_read ?? body.read ?? true,
        );
      case 'fn_widget_request_handoff':
        return this.requestHandoff(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_reason ?? body.reason ?? null,
        );
      case 'fn_widget_set_ai_assist':
        return this.setAiAssist(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_enabled ?? body.enabled ?? true,
        );
      case 'fn_widget_set_topic':
        return this.setTopic(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_topic ?? body.topic ?? '',
        );
      case 'fn_widget_mark_resolved':
        return this.markResolved(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
        );
      case 'fn_widget_welcome':
        return this.saveWelcome(
          body.p_visitor_id ?? body.visitorId,
          body.p_token ?? body.token,
          body.p_conversation_id ?? body.conversationId,
          body.p_content ?? body.content ?? '',
        );
      default:
        throw new BadRequestException(`Unsupported widget RPC function: ${fnName}`);
    }
  }
}
