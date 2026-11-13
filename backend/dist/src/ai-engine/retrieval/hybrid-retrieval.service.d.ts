import { DatabaseService } from '../../database/database.service';
import { GroundedChunk } from '../interfaces/llm-provider.interface';
export declare class HybridRetrievalService {
    private readonly db;
    private readonly logger;
    constructor(db: DatabaseService);
    retrieveChunks(workspaceId: string, query: string, queryEmbedding?: number[], limit?: number): Promise<GroundedChunk[]>;
}
