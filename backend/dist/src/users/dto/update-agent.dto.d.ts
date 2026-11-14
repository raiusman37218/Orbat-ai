import { AgentRole, AgentStatus } from '../../common/types/tenant-context';
export declare class UpdateAgentDto {
    name?: string;
    displayName?: string;
    onCallPhone?: string;
    spokenLanguages?: string[];
    availabilityMode?: 'online' | 'away' | 'dnd' | 'offline';
    avatarUrl?: string;
    role?: AgentRole;
    status?: AgentStatus;
    isActive?: boolean;
    maxOpenTickets?: number;
}
