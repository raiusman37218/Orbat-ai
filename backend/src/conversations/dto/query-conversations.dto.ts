import { IsOptional, IsString, IsIn, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryConversationsDto {
  @IsOptional()
  @IsIn(['open', 'closed', 'snoozed', 'pending', 'all'])
  status?: string = 'open';

  @IsOptional()
  @IsIn(['bot_active', 'handoff_offered', 'waiting_for_agent', 'agent_active', 'offline_queued', 'resolved'])
  handoffStatus?: string;

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unassigned?: boolean;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 30;
}

