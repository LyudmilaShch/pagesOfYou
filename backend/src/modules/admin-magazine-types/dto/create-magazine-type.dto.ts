import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BadgeType } from '@prisma/client';

export class CreateMagazineTypeDto {
  @ApiProperty({ example: 'Журнал подруге' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'friend',
    description: 'URL-safe slug: lowercase letters, digits and hyphens only',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric, words separated by hyphens',
  })
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ example: 'Журнал с воспоминаниями для близкой подруги.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/covers/friend.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @ApiPropertyOptional({ example: 4900, description: 'Base (current) price in RUB', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @ApiPropertyOptional({ example: 7900, description: 'Old price — shown crossed-out when present', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  oldPrice?: number;

  @ApiPropertyOptional({ enum: BadgeType, example: BadgeType.TOP })
  @IsOptional()
  @IsEnum(BadgeType)
  badgeType?: BadgeType;

  @ApiPropertyOptional({ example: 'Хит сезона', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  badgeText?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'Журнал подруге — персональный подарок' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @ApiPropertyOptional({ example: 'Создайте персональный журнал с воспоминаниями для подруги.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;
}
