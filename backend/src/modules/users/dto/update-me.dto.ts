import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  /**
   * Display name. An empty string clears it, reverting the UI to the auto-assigned
   * "Пользователь #<userNumber>" fallback.
   */
  @ApiPropertyOptional({ example: 'Мария', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  /**
   * URL of an already-uploaded image (via `POST /files/image`) to use as the avatar. An empty
   * string removes the current avatar.
   */
  @ApiPropertyOptional({ example: 'http://localhost:3000/uploads/order-photos/abc.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}
