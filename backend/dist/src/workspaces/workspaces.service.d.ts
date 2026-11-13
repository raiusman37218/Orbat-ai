import { DatabaseService } from '../database/database.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
export declare class WorkspacesService {
    private readonly db;
    private readonly logger;
    constructor(db: DatabaseService);
    getWorkspace(workspaceId: string): Promise<any>;
    updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto): Promise<any>;
    getMembers(workspaceId: string): Promise<any[]>;
    getWorkspaceStats(workspaceId: string): Promise<{
        conversations: {
            open: number;
            closed: number;
            waitingHandoff: number;
            offlineQueued: number;
        };
        agents: {
            total: number;
            online: number;
            away: number;
        };
        visitors: {
            total: number;
            online: number;
        };
    }>;
}
