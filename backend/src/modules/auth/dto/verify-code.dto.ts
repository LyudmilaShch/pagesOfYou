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
   * OTP code received via SMS (or logged to console in MVP). Normally 6 digits, but accepted
   * down to 4 — see OtpService.verifyOtp's TEST_LOGIN_PHONES block for why.
   * @example "123456"
   */
  @ApiProperty({
    example: '123456',
    description: '4-6 digit verification code',
  })
  @IsString()
  @Length(4, 6, { message: 'Code must be 4 to 6 digits' })
  @Matches(/^\d{4,6}$/, { message: 'Code must contain only digits' })
  code: string;
}
