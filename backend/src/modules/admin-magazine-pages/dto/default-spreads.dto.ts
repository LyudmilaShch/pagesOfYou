import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JournalSpreadLayout } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MIN_JOURNAL_SPREADS } from '../../../shared/constants/journal.constants';

export class DefaultSpreadItemDto {
  @ApiProperty({ enum: JournalSpreadLayout })
  @IsEnum(JournalSpreadLayout)
  layoutMode!: JournalSpreadLayout;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  magazinePageId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rightMagazinePageId?: string;
}

export class SetMagazineDefaultSpreadsDto {
  @ApiProperty({ type: [DefaultSpreadItemDto], minItems: MIN_JOURNAL_SPREADS })
  @IsArray()
  @ArrayMinSize(MIN_JOURNAL_SPREADS)
  @ValidateNested({ each: true })
  @Type(() => DefaultSpreadItemDto)
  spreads!: DefaultSpreadItemDto[];
}
