import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GroundedChunk } from '../interfaces/llm-provider.interface';

@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);

  constructor(private readonly db: DatabaseService) {}

  async retrieveChunks(
    workspaceId: string,
    query: string,
    queryEmbedding?: number[],
    limit: number = 5,
  ): Promise<GroundedChunk[]> {
    const cleanedQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');
    const searchTerms = cleanedQuery.split(/\s+/).filter(Boolean);

    // If query has words, run BM25/FTS search against bot_knowledge_chunks
    if (searchTerms.length > 0) {
      const tsQuery = searchTerms.join(' | ');
      const sql = `
        SELECT c.id as chunk_id, c.knowledge_id, c.title, c.content,
               ts_rank_cd(c.fts, to_tsquery('english', $1)) as rank
        FROM public.bot_knowledge_chunks c
        WHERE c.workspace_id = $2
          AND c.fts @@ to_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT $3
      `;

      try {
        const result = await this.db.query(sql, [tsQuery, workspaceId, limit]);
        if (result.rows.length > 0) {
          return result.rows.map((row: any) => ({
            chunkId: row.chunk_id,
            knowledgeId: row.knowledge_id,
            title: row.title || 'Knowledge Base Document',
            content: row.content,
            similarityScore: Number(row.rank || 0.5),
          }));
        }
      } catch (err: any) {
        this.logger.warn(`FTS search error: ${err.message}`);
      }
    }

    // Fallback: ILIKE search against active knowledge documents
    const fallbackSql = `
      SELECT k.id as knowledge_id, k.title, k.content
      FROM public.bot_knowledge k
      WHERE k.workspace_id = $1
        AND k.status = 'active'
        AND (k.title ILIKE $2 OR k.content ILIKE $2)
      LIMIT $3
    `;
    const searchPattern = `%${searchTerms[0] || 'support'}%`;
    try {
      const fbResult = await this.db.query(fallbackSql, [workspaceId, searchPattern, limit]);
      return fbResult.rows.map((row: any) => ({
        chunkId: row.knowledge_id,
        knowledgeId: row.knowledge_id,
        title: row.title,
        content: row.content,
        similarityScore: 0.4,
      }));
    } catch (err: any) {
      this.logger.warn(`Fallback search error: ${err.message}`);
      return [];
    }
  }
}

