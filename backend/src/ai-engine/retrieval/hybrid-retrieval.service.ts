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
    const safeLimit = Math.min(Math.max(1, Math.floor(limit || 5)), 20);
    const cleanedQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');
    const searchTerms = cleanedQuery.split(/\s+/).filter(Boolean);

    const hasValidEmbedding =
      Array.isArray(queryEmbedding) &&
      queryEmbedding.length === 768 &&
      queryEmbedding.every((n) => typeof n === 'number' && Number.isFinite(n));

    const vectorRows: Array<any> = [];
    const ftsRows: Array<any> = [];

    if (hasValidEmbedding) {
      const vectorLiteral = `[${queryEmbedding!.join(',')}]`;
      try {
        const vecRes = await this.db.query(
          `SELECT c.id as chunk_id, c.knowledge_id, c.title, c.content,
                  1 - (c.embedding <=> $2::vector) as sim
           FROM public.bot_knowledge_chunks c
           WHERE c.workspace_id = $1
             AND c.embedding IS NOT NULL
           ORDER BY c.embedding <=> $2::vector ASC
           LIMIT $3`,
          [workspaceId, vectorLiteral, safeLimit * 2],
        );
        if (Array.isArray(vecRes?.rows)) {
          vectorRows.push(...vecRes.rows);
        }
      } catch (err: any) {
        this.logger.warn(`Vector search error: ${err.message}`);
      }
    }

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
        const result = await this.db.query(sql, [tsQuery, workspaceId, safeLimit * 2]);
        if (Array.isArray(result?.rows)) {
          ftsRows.push(...result.rows);
        }
      } catch (err: any) {
        this.logger.warn(`FTS search error: ${err.message}`);
      }
    }

    // Reciprocal Rank Fusion (RRF) combining semantic vector hits + lexical FTS hits
    if (vectorRows.length > 0 || ftsRows.length > 0) {
      const fused = new Map<
        string,
        { chunk: GroundedChunk; rrfScore: number; rawSim: number }
      >();
      const k = 60;

      vectorRows.forEach((row, idx) => {
        const key = String(row.chunk_id);
        const rawSim = Number(row.sim || 0);
        const existing = fused.get(key);
        const score = 1 / (k + idx + 1);
        if (existing) {
          existing.rrfScore += score;
          existing.rawSim = Math.max(existing.rawSim, rawSim);
        } else {
          fused.set(key, {
            rrfScore: score,
            rawSim,
            chunk: {
              chunkId: key,
              knowledgeId: row.knowledge_id,
              title: row.title || 'Knowledge Base Document',
              content: row.content,
              similarityScore: rawSim,
            },
          });
        }
      });

      ftsRows.forEach((row, idx) => {
        const key = String(row.chunk_id);
        const rankScore = Number(row.rank || 0.5);
        const existing = fused.get(key);
        const score = 1 / (k + idx + 1);
        if (existing) {
          existing.rrfScore += score;
        } else {
          fused.set(key, {
            rrfScore: score,
            rawSim: rankScore,
            chunk: {
              chunkId: key,
              knowledgeId: row.knowledge_id,
              title: row.title || 'Knowledge Base Document',
              content: row.content,
              similarityScore: rankScore,
            },
          });
        }
      });

      return Array.from(fused.values())
        .sort((a, b) => b.rrfScore - a.rrfScore || b.rawSim - a.rawSim)
        .slice(0, safeLimit)
        .map((entry) => ({
          ...entry.chunk,
          similarityScore: Number(entry.rrfScore.toFixed(6)),
        }));
    }

    // Fallback: ILIKE search against active knowledge documents
    const fallbackSql = `
      SELECT k.id as knowledge_id, k.title, k.content
      FROM public.bot_knowledge k
      WHERE k.workspace_id = $1
        AND k.status IN ('ready', 'pending')
        AND (k.title ILIKE $2 OR k.content ILIKE $2)
      LIMIT $3
    `;
    const searchPattern = `%${searchTerms[0] || 'support'}%`;
    try {
      const fbResult = await this.db.query(fallbackSql, [workspaceId, searchPattern, safeLimit]);
      return (fbResult?.rows || []).map((row: any) => ({
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

