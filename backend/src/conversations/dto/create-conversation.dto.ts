import { IsNotEmpty, IsOptional, IsString, IsIn, IsArray } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  visitorId: string;

  @IsOptional()
  @IsIn(['web', 'whatsapp', 'instagram', 'email', 'social'])
  channel?: string = 'web';

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string = 'normal';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  initialMessage?: string;
}

