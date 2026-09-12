import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ApplyPromoCodeDto {
  @ApiProperty({ example: 'PAGES10' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
