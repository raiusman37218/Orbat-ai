import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from './realtime.service';
export interface OutboxEventInput {
    workspaceId: string;
    conversationId?: string | null;
    eventName: string;
    rooms: string[];
    payload: Record<string, any>;
}
export declare class OutboxService {
    private readonly db;
    private readonly realtime?;
    private readonly logger;
    constructor(db: DatabaseService, realtime?: RealtimeService | undefined);
    recordInTransaction(client: PoolClient, input: OutboxEventInput): Promise<string | null>;
    markPublished(id: string): Promise<void>;
    relayPendingEvents(batchSize?: number): Promise<{
        relayed: number;
        failed: number;
    }>;
}
