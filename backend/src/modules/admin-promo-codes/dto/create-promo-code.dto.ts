import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum PromoCodeDiscountType {
  PERCENT = 'PERCENT',
  AMOUNT = 'AMOUNT',
}

export class CreatePromoCodeDto {
  @ApiProperty({ example: 'PAGES10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ enum: PromoCodeDiscountType })
  @IsEnum(PromoCodeDiscountType)
  discountType!: PromoCodeDiscountType;

  @ApiProperty({ example: 10, description: 'Percent (1-100) or a fixed amount in RUB, depending on discountType' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  discountValue!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 100, description: 'Max number of times this code can be used' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;
}
