import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreatePhotoFrameDto {
  @ApiProperty({ example: 'Золотая рамка' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  imageUrl: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  naturalWidth: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  naturalHeight: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceTop: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceRight: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceBottom: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceLeft: number;

  @ApiProperty({ description: 'Photo window inset from top, in source PNG px' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaTop: number;

  @ApiProperty({ description: 'Photo window inset from right, in source PNG px' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaRight: number;

  @ApiProperty({ description: 'Photo window inset from bottom, in source PNG px' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaBottom: number;

  @ApiProperty({ description: 'Photo window inset from left, in source PNG px' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaLeft: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePhotoFrameDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  naturalWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  naturalHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceTop?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceRight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceBottom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sliceLeft?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaTop?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaRight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaBottom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  photoAreaLeft?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderPhotoFrameItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderPhotoFramesDto {
  @ApiProperty({ type: [ReorderPhotoFrameItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderPhotoFrameItemDto)
  items: ReorderPhotoFrameItemDto[];
}
