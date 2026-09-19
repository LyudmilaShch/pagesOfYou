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
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

const QUESTION_KEY_PATTERN = /^[a-z0-9_-]+$/;

export class QuestionOptionDto {
  @ApiProperty({ example: 'Москва' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @ApiProperty({ example: 'moscow' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'meeting_place',
    description: 'Уникален в рамках типа журнала, на него ссылаются элементы канваса (questionKey)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(QUESTION_KEY_PATTERN, {
    message: 'key может содержать только строчные латинские буквы, цифры, "_" и "-"',
  })
  key: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ example: 'Где вы познакомились?' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [QuestionOptionDto], description: 'Только для type = SELECT' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({
    description:
      'Нельзя изменить, если key уже используется элементом (questionKey/questionKeys) на любой странице типа журнала',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(QUESTION_KEY_PATTERN, {
    message: 'key может содержать только строчные латинские буквы, цифры, "_" и "-"',
  })
  key?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [QuestionOptionDto], description: 'Только для type = SELECT; полностью заменяет текущий список' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];
}

export class ReorderQuestionItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderQuestionsDto {
  @ApiProperty({ type: [ReorderQuestionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionItemDto)
  items: ReorderQuestionItemDto[];
}
