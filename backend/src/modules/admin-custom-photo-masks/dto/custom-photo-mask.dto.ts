import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomPhotoMaskPointDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;
}

export class CreateCustomPhotoMaskDto {
  @ApiProperty({ example: 'Облако' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    type: [CustomPhotoMaskPointDto],
    description: 'Normalized (0..1) polygon sampled from the source SVG path.',
  })
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => CustomPhotoMaskPointDto)
  points: CustomPhotoMaskPointDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCustomPhotoMaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: [CustomPhotoMaskPointDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => CustomPhotoMaskPointDto)
  points?: CustomPhotoMaskPointDto[];

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

export class ReorderCustomPhotoMaskItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderCustomPhotoMasksDto {
  @ApiProperty({ type: [ReorderCustomPhotoMaskItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCustomPhotoMaskItemDto)
  items: ReorderCustomPhotoMaskItemDto[];
}
