import { IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  idToken?: string;

  @IsString()
  @IsOptional()
  credential?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}

