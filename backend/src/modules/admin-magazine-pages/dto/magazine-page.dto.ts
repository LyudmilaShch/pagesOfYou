import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageType } from '@prisma/client';
import type { CanvasData } from '../../../shared/types/canvas-data.types';

export class CreateMagazinePageDto {
  @ApiProperty({ example: 'Обложка' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PageType, default: PageType.PAGE })
  @IsOptional()
  @IsEnum(PageType)
  pageType?: PageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  canvasData?: CanvasData;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateMagazinePageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PageType })
  @IsOptional()
  @IsEnum(PageType)
  pageType?: PageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  canvasData?: CanvasData;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class DuplicateMagazinePageDto {
  @ApiPropertyOptional({
    description: 'Если не задано — дублирует страницу в тот же тип журнала',
  })
  @IsOptional()
  @IsString()
  targetMagazineTypeId?: string;
}

export class ReorderMagazinePageItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderMagazinePagesDto {
  @ApiProperty({ type: [ReorderMagazinePageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMagazinePageItemDto)
  items: ReorderMagazinePageItemDto[];
}
