import { ArrayMinSize, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';

export class BulkUpdateConversationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['resolve', 'reopen', 'assign', 'spam'])
  action!: 'resolve' | 'reopen' | 'assign' | 'spam';

  @IsOptional()
  @IsUUID()
  agentId?: string | null;
}
