import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class GenerateAiReplyDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  triggerMessage!: string;

  @IsOptional()
  @IsUUID()
  triggerMessageId?: string;
}

