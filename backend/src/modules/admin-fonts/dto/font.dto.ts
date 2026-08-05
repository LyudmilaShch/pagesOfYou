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

export class CreateFontDto {
  @ApiProperty({ example: 'Brand Sans' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Regular weight — required baseline face' })
  @IsString()
  regularFileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boldFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  italicFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boldItalicFileUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFontDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Regular weight — required baseline face' })
  @IsOptional()
  @IsString()
  regularFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boldFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  italicFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boldItalicFileUrl?: string;

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

export class ReorderFontItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderFontsDto {
  @ApiProperty({ type: [ReorderFontItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderFontItemDto)
  items: ReorderFontItemDto[];
}
