import { AgentRole } from '../../common/types/tenant-context';
export declare class CreateAgentDto {
    name: string;
    email: string;
    role: AgentRole;
    password?: string;
}
