import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { JournalSpreadLayout, PageType } from '@prisma/client';
import type { CanvasData } from '../../../shared/types/canvas-data.types';

/** One journal page as already assembled client-side (e.g. a guest's local draft) — used to
 * recreate a real order with exactly the pages/content the user already built, instead of
 * seeding fresh default pages. */
export class CreateOrderJournalPageDto {
  @ApiProperty({ enum: PageType })
  @IsEnum(PageType)
  slotType: PageType;

  @ApiPropertyOptional({ enum: JournalSpreadLayout })
  @IsOptional()
  @IsEnum(JournalSpreadLayout)
  layoutMode?: JournalSpreadLayout | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  magazinePageId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rightMagazinePageId?: string | null;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  pageSnapshot: CanvasData;
}

export class CreateDraftOrderDto {
  @ApiProperty({ description: 'Selected magazine type (product) id' })
  @IsString()
  @MinLength(1)
  magazineTypeId: string;

  /** When provided, the order is created with exactly these pages instead of the magazine
   * type's default template layout — used to turn a guest's already-built local draft into a
   * real order. */
  @ApiPropertyOptional({ type: [CreateOrderJournalPageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderJournalPageDto)
  journalPages?: CreateOrderJournalPageDto[];
}
