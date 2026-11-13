import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @ValidateIf((o) => !o.attachmentUrl)
  @IsString()
  @IsNotEmpty({ message: 'Message content or attachment is required.' })
  content?: string = '';

  @IsOptional()
  @IsIn(['agent', 'visitor', 'system', 'ai'])
  senderType?: 'agent' | 'visitor' | 'system' | 'ai' = 'agent';

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = false;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

