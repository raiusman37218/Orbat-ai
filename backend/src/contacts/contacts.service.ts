import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly db: DatabaseService) {}

  async getContacts(workspaceId: string, query: QueryContactsDto) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['workspace_id = $1'];
    const params: any[] = [workspaceId];
    let idx = 2;

    if (query.q) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${query.q.trim()}%`);
      idx++;
    }

    if (query.onlineOnly) {
      conditions.push(`is_online = true`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await this.db.query(
      `SELECT COUNT(*) as total FROM public.visitors WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Paginated list
    const listRes = await this.db.query(
      `SELECT id, name, email, current_page_url, current_page_title,
              ip_location_city, ip_location_country, device, browser, os,
              visit_count, is_online, last_seen_at, first_seen_at, channel
       FROM public.visitors
       WHERE ${whereClause}
       ORDER BY last_seen_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );

    return {
      items: listRes.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContactById(workspaceId: string, contactId: string) {
    const [visitorRes, historyRes] = await Promise.all([
      this.db.query(
        `SELECT id, name, email, current_page_url, current_page_title,
                ip_location_city, ip_location_country, device, browser, os,
                referrer_source, visit_count, is_online, timezone, language,
                channel, channel_user_id, last_seen_at, first_seen_at
         FROM public.visitors
         WHERE id = $1 AND workspace_id = $2
         LIMIT 1`,
        [contactId, workspaceId],
      ),
      this.db.query(
        `SELECT id, url, title, duration_seconds, visited_at
         FROM public.visitor_page_history
         WHERE visitor_id = $1 AND workspace_id = $2
         ORDER BY visited_at DESC
         LIMIT 20`,
        [contactId, workspaceId],
      ),
    ]);

    if (visitorRes.rows.length === 0) {
      throw new NotFoundException(`Contact with ID ${contactId} not found.`);
    }

    return {
      ...visitorRes.rows[0],
      pageHistory: historyRes.rows,
    };
  }

  async createOrUpsertContact(workspaceId: string, dto: CreateContactDto) {
    // If email provided, check if existing visitor exists with same email in workspace
    if (dto.email) {
      const existing = await this.db.query(
        `SELECT id FROM public.visitors WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [workspaceId, dto.email.trim().toLowerCase()],
      );

      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await this.db.query(
          `UPDATE public.visitors
           SET last_seen_at = now(),
               is_online = true,
               visit_count = visit_count + 1,
               current_page_url = COALESCE($1, current_page_url),
               current_page_title = COALESCE($2, current_page_title)
           WHERE id = $3 AND workspace_id = $4`,
          [dto.currentPageUrl, dto.currentPageTitle, id, workspaceId],
        );
        return this.getContactById(workspaceId, id);
      }
    }

    // Insert new contact
    const result = await this.db.query(
      `INSERT INTO public.visitors (
         workspace_id, name, email, current_page_url, current_page_title,
         device, browser, os, ip_location_city, ip_location_country,
         timezone, language, channel, channel_user_id, is_online
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
       RETURNING id, name, email, current_page_url, is_online, last_seen_at, first_seen_at`,
      [
        workspaceId,
        dto.name?.trim() || null,
        dto.email?.trim().toLowerCase() || null,
        dto.currentPageUrl || '/',
        dto.currentPageTitle || null,
        dto.device || null,
        dto.browser || null,
        dto.os || null,
        dto.ipLocationCity || null,
        dto.ipLocationCountry || null,
        dto.timezone || 'UTC',
        dto.language || 'en',
        dto.channel || 'web',
        dto.channelUserId || null,
      ],
    );

    return result.rows[0];
  }

  async updateContact(workspaceId: string, contactId: string, dto: UpdateContactDto) {
    await this.getContactById(workspaceId, contactId);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(dto.email.trim().toLowerCase());
    }
    if (dto.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(dto.timezone);
    }
    if (dto.language !== undefined) {
      fields.push(`language = $${idx++}`);
      values.push(dto.language);
    }

    if (fields.length === 0) {
      return this.getContactById(workspaceId, contactId);
    }

    values.push(contactId, workspaceId);
    const sql = `
      UPDATE public.visitors
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND workspace_id = $${idx}
      RETURNING id, name, email, timezone, language, last_seen_at
    `;

    const result = await this.db.query(sql, values);
    return result.rows[0];
  }

  async getConversations(workspaceId: string, contactId: string) {
    const result = await this.db.query(
      `SELECT c.id, c.status, c.priority, c.channel, c.handoff_status, c.ai_mode,
              c.created_at, c.updated_at, c.closed_at,
              a.name as assigned_agent_name,
              (SELECT content FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
              (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
       FROM public.conversations c
       LEFT JOIN public.agents a ON a.id = c.assigned_agent_id
       WHERE c.visitor_id = $1 AND c.workspace_id = $2
       ORDER BY c.updated_at DESC`,
      [contactId, workspaceId],
    );

    return result.rows;
  }

  async getLiveVisitorMeta(workspaceId: string, visitorIds: string[]) {
    const validIds = visitorIds.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    );
    if (validIds.length === 0) {
      return { pageHistory: [], openTickets: [] };
    }

    const [historyRes, ticketsRes] = await Promise.all([
      this.db.query(
        `SELECT * FROM public.visitor_page_history
         WHERE workspace_id = $1 AND visitor_id = ANY($2::uuid[])
         ORDER BY visited_at DESC
         LIMIT 100`,
        [workspaceId, validIds],
      ),
      this.db.query(
        `SELECT id, number, subject, status, requester_id
         FROM public.tickets
         WHERE workspace_id = $1
           AND status IN ('new', 'open', 'pending', 'on_hold')
           AND requester_id = ANY($2::uuid[])`,
        [workspaceId, validIds],
      ),
    ]);

    return {
      pageHistory: historyRes.rows,
      openTickets: ticketsRes.rows,
    };
  }
}

