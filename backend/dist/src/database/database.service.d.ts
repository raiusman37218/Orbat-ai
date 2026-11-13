import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
export declare class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private pool;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    ping(): Promise<{
        ok: boolean;
        latencyMs: number;
        error?: string;
    }>;
}
