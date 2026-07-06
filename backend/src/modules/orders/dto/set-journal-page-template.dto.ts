import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JournalSpreadLayout } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SetJournalPageTemplateDto {
  @ApiProperty({ enum: JournalSpreadLayout, description: 'Only for spread slots' })
  @IsOptional()
  @IsEnum(JournalSpreadLayout)
  layoutMode?: JournalSpreadLayout;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  magazinePageId!: string;

  @ApiPropertyOptional({ description: 'Right page template when layoutMode is SPLIT_PAGES' })
  @IsOptional()
  @IsString()
  rightMagazinePageId?: string;
}
