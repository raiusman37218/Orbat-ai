import { IsOptional, IsString, IsIn, IsBoolean, IsInt, Min } from 'class-validator';
import { AgentRole, AgentStatus } from '../../common/types/tenant-context';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(['owner', 'admin', 'agent', 'light_agent'])
  role?: AgentRole;

  @IsOptional()
  @IsIn(['online', 'away', 'offline'])
  status?: AgentStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOpenTickets?: number;
}

