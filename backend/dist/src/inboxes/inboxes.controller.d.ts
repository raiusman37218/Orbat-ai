import { InboxesService } from './inboxes.service';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class InboxesController {
    private readonly inboxesService;
    constructor(inboxesService: InboxesService);
    getOverview(workspaceId: string, user: AuthenticatedUser): Promise<{
        myAssigned: number;
        unassigned: number;
        waitingHandoff: number;
        offlineQueued: number;
        botActive: number;
        closedToday: number;
    }>;
    getMyAssigned(workspaceId: string, user: AuthenticatedUser, page?: number, limit?: number): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getUnassigned(workspaceId: string, page?: number, limit?: number): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getWaitingHandoff(workspaceId: string, page?: number, limit?: number): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    autoAssign(workspaceId: string, conversationId: string): Promise<{
        assigned: boolean;
        reason: string;
        agent?: undefined;
    } | {
        assigned: boolean;
        agent: {
            id: any;
            name: any;
        };
        reason?: undefined;
    }>;
}
