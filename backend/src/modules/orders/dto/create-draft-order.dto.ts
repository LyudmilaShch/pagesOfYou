import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateDraftOrderDto {
  @ApiProperty({ description: 'Selected magazine type (product) id' })
  @IsString()
  @MinLength(1)
  magazineTypeId: string;
}
