import { IsEmail, IsNotEmpty, IsString, IsIn, MinLength, IsOptional } from 'class-validator';
import { AgentRole } from '../../common/types/tenant-context';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  @MinLength(2)
  name: string;

  @IsEmail({}, { message: 'Valid email address is required.' })
  @IsNotEmpty()
  email: string;

  @IsIn(['admin', 'agent', 'light_agent'], {
    message: 'Role must be admin, agent, or light_agent.',
  })
  role: AgentRole;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password?: string;
}

