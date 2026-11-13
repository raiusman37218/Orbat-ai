import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsNumber()
  @Min(1)
  @Max(50 * 1024 * 1024) // up to 50MB
  byteSize!: number;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

