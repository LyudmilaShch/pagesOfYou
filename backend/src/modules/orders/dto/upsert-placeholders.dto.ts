import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PlaceholderValueType } from '@prisma/client';

export class PlaceholderValueInputDto {
  @ApiProperty({ description: 'Canvas element id from pageSnapshot' })
  @IsString()
  @MinLength(1)
  elementId: string;

  @ApiProperty({ enum: PlaceholderValueType })
  @IsEnum(PlaceholderValueType)
  valueType: PlaceholderValueType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textValue?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  jsonValue?: Record<string, unknown>;
}

export class UpsertPlaceholdersDto {
  @ApiProperty({ type: [PlaceholderValueInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceholderValueInputDto)
  values: PlaceholderValueInputDto[];
}
