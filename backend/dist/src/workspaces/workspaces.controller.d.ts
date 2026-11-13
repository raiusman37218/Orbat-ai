import { WorkspacesService } from './workspaces.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
export declare class WorkspacesController {
    private readonly workspacesService;
    constructor(workspacesService: WorkspacesService);
    getCurrentWorkspace(workspaceId: string): Promise<any>;
    updateCurrentWorkspace(workspaceId: string, dto: UpdateWorkspaceDto): Promise<any>;
    getMembers(workspaceId: string): Promise<any[]>;
    getStats(workspaceId: string): Promise<{
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
