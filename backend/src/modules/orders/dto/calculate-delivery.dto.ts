import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CalculateDeliveryDto {
  @ApiProperty({ enum: DeliveryMethod })
  @IsEnum(DeliveryMethod)
  method!: DeliveryMethod;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ description: 'Pickup point address (PICKUP_POINT) or street address (COURIER)' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;
}
