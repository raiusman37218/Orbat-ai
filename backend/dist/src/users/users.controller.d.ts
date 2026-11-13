import { UsersService } from './users.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AuthenticatedUser } from '../common/types/tenant-context';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getAgents(workspaceId: string): Promise<any[]>;
    getAgentById(workspaceId: string, agentId: string): Promise<any>;
    createAgent(workspaceId: string, dto: CreateAgentDto, actor: AuthenticatedUser): Promise<any>;
    updateMyStatus(workspaceId: string, actor: AuthenticatedUser, status: 'online' | 'away' | 'offline'): Promise<any>;
    updateAgent(workspaceId: string, agentId: string, dto: UpdateAgentDto, actor: AuthenticatedUser): Promise<any>;
    deactivateAgent(workspaceId: string, agentId: string, actor: AuthenticatedUser): Promise<{
        success: boolean;
        message: string;
    }>;
}
