import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuestionAnswerInputDto {
  @ApiProperty({ description: 'Question.key this answer belongs to' })
  @IsString()
  @MinLength(1)
  questionKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textValue?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: '{ url } for IMAGE questions, { urls } for GALLERY questions',
  })
  @IsOptional()
  @IsObject()
  jsonValue?: Record<string, unknown>;
}

export class UpsertQuestionnaireAnswersDto {
  @ApiProperty({ type: [QuestionAnswerInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerInputDto)
  answers: QuestionAnswerInputDto[];
}
