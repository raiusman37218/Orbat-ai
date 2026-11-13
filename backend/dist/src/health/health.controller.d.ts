import { DatabaseService } from '../database/database.service';
export declare class HealthController {
    private readonly db;
    private readonly startTime;
    constructor(db: DatabaseService);
    check(): Promise<{
        status: string;
        timestamp: string;
        uptimeSeconds: number;
        database: {
            error?: string | undefined;
            connected: boolean;
            latencyMs: number;
        };
        system: {
            nodeVersion: string;
            memoryRssMb: number;
            memoryHeapUsedMb: number;
        };
    }>;
    liveness(): {
        status: string;
    };
    readiness(): Promise<{
        status: string;
        database: string | undefined;
    }>;
}
