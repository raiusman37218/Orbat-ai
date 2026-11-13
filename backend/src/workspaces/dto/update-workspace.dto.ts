import { IsOptional, IsString, IsHexColor, IsIn, IsObject } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsHexColor()
  brandColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  greetingTitle?: string;

  @IsOptional()
  @IsString()
  greetingMessage?: string;

  @IsOptional()
  @IsIn(['right', 'left'])
  widgetPosition?: 'right' | 'left';

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, any>;

  @IsOptional()
  @IsObject()
  aiSettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  handoffSettings?: Record<string, any>;
}

