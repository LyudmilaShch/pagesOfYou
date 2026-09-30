import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class RemoveJournalSpreadsDto {
  @ApiProperty({
    description: 'Journal page ids of SPREAD slots to remove — must be an even count (4 pages per print signature)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  spreadIds!: string[];
}
