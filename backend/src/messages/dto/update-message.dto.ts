import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty.' })
  content!: string;
}
