import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  /**
   * @example "+79001234567"
   */
  @ApiProperty({
    example: '+79001234567',
    description: 'Phone number in E.164 format',
  })
  @IsString()
  @IsPhoneNumber()
  phone: string;

  /**
   * 6-digit OTP code received via SMS (or logged to console in MVP).
   * @example "123456"
   */
  @ApiProperty({
    example: '123456',
    description: '6-digit verification code',
  })
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Code must contain only digits' })
  code: string;
}
