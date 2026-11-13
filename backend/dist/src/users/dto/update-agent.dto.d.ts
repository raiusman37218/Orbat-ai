import { AgentRole, AgentStatus } from '../../common/types/tenant-context';
export declare class UpdateAgentDto {
    name?: string;
    avatarUrl?: string;
    role?: AgentRole;
    status?: AgentStatus;
    isActive?: boolean;
    maxOpenTickets?: number;
}
