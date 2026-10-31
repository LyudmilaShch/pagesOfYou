import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JournalSpreadLayout, PageType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Generous for a real questionnaire, tight enough that this can't be used as a free LLM proxy
// with arbitrary long input — the prompt itself always comes from the template in the DB.
const MAX_ANSWER_LENGTH = 5000;
const MAX_TEXT_LENGTH = 3000;

export type DraftAiTextPurpose = 'fill' | 'update' | 'regenerate';

export class DraftAnswerDto {
  @IsString()
  @MaxLength(200)
  questionKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANSWER_LENGTH)
  textValue?: string;
}

/** Which template(s) the page was built from — the server rebuilds the page from these, it never
 * trusts a page snapshot (and so a prompt) sent by the browser. */
export class DraftPageDto {
  @IsEnum(PageType)
  slotType: PageType;

  @IsOptional()
  @IsEnum(JournalSpreadLayout)
  layoutMode?: JournalSpreadLayout | null;

  @IsString()
  magazinePageId: string;

  @IsOptional()
  @IsString()
  rightMagazinePageId?: string | null;
}

export class DraftTextDto {
  @IsString()
  @MaxLength(200)
  elementId: string;

  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  text: string;
}

/**
 * AI text for a journal that only exists in the browser (a guest's local draft — or a signed-in
 * customer's, before it's saved as an order). Same generation as the order flow, but everything
 * the order flow reads from the DB (answers, the page's other texts) comes from the request.
 */
export class GenerateDraftAiTextDto {
  @ApiPropertyOptional({ description: 'Guest token — required when not signed in' })
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @ApiProperty()
  @IsString()
  magazineTypeId: string;

  @ApiProperty({ type: DraftPageDto })
  @ValidateNested()
  @Type(() => DraftPageDto)
  page: DraftPageDto;

  @ApiProperty({ description: 'Any part of the target text (a standalone block or a chain part)' })
  @IsString()
  @MaxLength(200)
  elementId: string;

  @ApiProperty({ enum: ['all', 'part'], description: "'all' — the whole text (every part); 'part' — rewrite only elementId" })
  @IsIn(['all', 'part'])
  scope: 'all' | 'part';

  @ApiProperty({
    enum: ['fill', 'update', 'regenerate'],
    description:
      "'fill' — the text's first version; 'update' — rewritten after an answer change; 'regenerate' — 🔄. " +
      'Decides which daily counter is charged (see AiUsageKind).',
  })
  @IsIn(['fill', 'update', 'regenerate'])
  purpose: DraftAiTextPurpose;

  @ApiProperty({ type: [DraftAnswerDto] })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => DraftAnswerDto)
  answers: DraftAnswerDto[];

  @ApiPropertyOptional({ type: [DraftTextDto], description: "The text's other parts as they are now (scope 'part')" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DraftTextDto)
  currentTexts?: DraftTextDto[];

  @ApiPropertyOptional({ description: "The journal's other AI texts (journal-wide texts only)" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(MAX_TEXT_LENGTH, { each: true })
  journalTexts?: string[];
}
