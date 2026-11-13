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
var HybridRetrievalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRetrievalService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../database/database.service");
let HybridRetrievalService = HybridRetrievalService_1 = class HybridRetrievalService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(HybridRetrievalService_1.name);
    }
    async retrieveChunks(workspaceId, query, queryEmbedding, limit = 5) {
        const cleanedQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');
        const searchTerms = cleanedQuery.split(/\s+/).filter(Boolean);
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
                    return result.rows.map((row) => ({
                        chunkId: row.chunk_id,
                        knowledgeId: row.knowledge_id,
                        title: row.title || 'Knowledge Base Document',
                        content: row.content,
                        similarityScore: Number(row.rank || 0.5),
                    }));
                }
            }
            catch (err) {
                this.logger.warn(`FTS search error: ${err.message}`);
            }
        }
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
            return fbResult.rows.map((row) => ({
                chunkId: row.knowledge_id,
                knowledgeId: row.knowledge_id,
                title: row.title,
                content: row.content,
                similarityScore: 0.4,
            }));
        }
        catch (err) {
            this.logger.warn(`Fallback search error: ${err.message}`);
            return [];
        }
    }
};
exports.HybridRetrievalService = HybridRetrievalService;
exports.HybridRetrievalService = HybridRetrievalService = HybridRetrievalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], HybridRetrievalService);
//# sourceMappingURL=hybrid-retrieval.service.js.map