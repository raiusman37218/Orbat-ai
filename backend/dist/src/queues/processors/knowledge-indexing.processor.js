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
var KnowledgeIndexingProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeIndexingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../queue.constants");
const database_service_1 = require("../../database/database.service");
const llm_provider_interface_1 = require("../../ai-engine/interfaces/llm-provider.interface");
const queues_service_1 = require("../queues.service");
const base_processor_1 = require("./base.processor");
function chunkDocumentText(text, maxChars = 900, overlap = 120) {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized)
        return [];
    if (normalized.length <= maxChars)
        return [normalized];
    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
        let end = Math.min(normalized.length, start + maxChars);
        if (end < normalized.length) {
            const breakIdx = normalized.lastIndexOf('\n\n', end);
            if (breakIdx > start + 200) {
                end = breakIdx;
            }
        }
        const piece = normalized.slice(start, end).trim();
        if (piece)
            chunks.push(piece);
        if (end >= normalized.length)
            break;
        start = Math.max(end - overlap, start + 1);
    }
    return chunks;
}
let KnowledgeIndexingProcessor = KnowledgeIndexingProcessor_1 = class KnowledgeIndexingProcessor extends base_processor_1.BaseQueueProcessor {
    constructor(db, llm, queuesService) {
        super(queuesService);
        this.db = db;
        this.llm = llm;
        this.logger = new common_1.Logger(KnowledgeIndexingProcessor_1.name);
    }
    async process(job) {
        const { workspaceId, knowledgeId, action } = job.data;
        if (!this.db) {
            return { workspaceId, knowledgeId, skipped: true, reason: 'database_unavailable' };
        }
        if (action === 'delete_document') {
            await this.db.query('DELETE FROM public.bot_knowledge_chunks WHERE knowledge_id = $1 AND workspace_id = $2', [knowledgeId, workspaceId]);
            return { deleted: true, knowledgeId };
        }
        const rowRes = await this.db.query(`SELECT id, workspace_id, title, content, content_version
       FROM public.bot_knowledge
       WHERE id = $1 AND workspace_id = $2
       LIMIT 1`, [knowledgeId, workspaceId]);
        const entry = rowRes?.rows?.[0];
        if (!entry) {
            return { skipped: true, reason: 'knowledge_entry_not_found', knowledgeId };
        }
        const textChunks = chunkDocumentText(`${entry.title}\n\n${entry.content}`);
        let embeddings = textChunks.map(() => null);
        if (textChunks.length > 0 && this.llm?.generateEmbeddings) {
            try {
                const vectors = await this.llm.generateEmbeddings(textChunks);
                embeddings = textChunks.map((_, idx) => Array.isArray(vectors[idx]) && vectors[idx].length === 768 ? vectors[idx] : null);
            }
            catch (err) {
                this.logger.warn(`Embedding generation failed for ${knowledgeId}; storing FTS chunks: ${err?.message}`);
            }
        }
        const payload = textChunks.map((content, chunkIndex) => ({
            chunk_index: chunkIndex,
            content,
            token_count: Math.ceil(content.length / 4),
            embedding: embeddings[chunkIndex],
        }));
        const storedRes = await this.db.query('SELECT public.fn_store_bot_knowledge_chunks($1::uuid, $2::int, $3::jsonb, $4::text) AS stored', [knowledgeId, entry.content_version, JSON.stringify(payload), null]);
        return {
            indexed: Boolean(storedRes?.rows?.[0]?.stored),
            knowledgeId,
            chunkCount: payload.length,
        };
    }
};
exports.KnowledgeIndexingProcessor = KnowledgeIndexingProcessor;
exports.KnowledgeIndexingProcessor = KnowledgeIndexingProcessor = KnowledgeIndexingProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_KNOWLEDGE_INDEXING, {
        concurrency: 2,
        lockDuration: 120_000,
    }),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(llm_provider_interface_1.LLM_PROVIDER)),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [database_service_1.DatabaseService, Object, queues_service_1.QueuesService])
], KnowledgeIndexingProcessor);
//# sourceMappingURL=knowledge-indexing.processor.js.map