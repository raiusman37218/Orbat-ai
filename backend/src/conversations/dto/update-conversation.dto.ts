import { IsOptional, IsIn, IsArray, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsIn(['open', 'closed', 'snoozed', 'pending'])
  status?: 'open' | 'closed' | 'snoozed' | 'pending';

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @IsOptional()
  @IsIn(['autopilot', 'copilot', 'disabled'])
  aiMode?: 'autopilot' | 'copilot' | 'disabled';

  @IsOptional()
  @IsIn(['bot_active', 'handoff_offered', 'waiting_for_agent', 'agent_active', 'offline_queued', 'resolved'])
  handoffStatus?:
    | 'bot_active'
    | 'handoff_offered'
    | 'waiting_for_agent'
    | 'agent_active'
    | 'offline_queued'
    | 'resolved';

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsUUID()
  assignedAgentId?: string | null;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  snoozedUntil?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

