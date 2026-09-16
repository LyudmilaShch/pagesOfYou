import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  // ── Real values from the CDEK widget's onCalculate/onChoose callback ────────────────────────
  // When present, these are used as-is instead of the stub formula — see
  // OrdersService.calculateDelivery. Absent (e.g. the widget isn't configured yet, or someone
  // calls this endpoint directly) → falls back to the stub.

  @ApiPropertyOptional({ description: 'Real delivery price from the CDEK widget, in RUB' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Real delivery ETA from the CDEK widget, in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  etaDays?: number;

  @ApiPropertyOptional({ description: 'CDEK pickup point code, when method is PICKUP_POINT' })
  @IsOptional()
  @IsString()
  pickupPointCode?: string;
}
