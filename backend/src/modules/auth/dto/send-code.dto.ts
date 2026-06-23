import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class SendCodeDto {
  /**
   * Phone number in E.164 format.
   * @example "+79001234567"
   */
  @ApiProperty({
    example: '+79001234567',
    description: 'Phone number in E.164 format (e.g. +79001234567)',
  })
  @IsString()
  @IsPhoneNumber()
  phone: string;
}
