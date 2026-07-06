import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderJournalSpreadsDto {
  @ApiProperty({
    description: 'Journal page ids for spread slots in the desired order',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  spreadIds!: string[];
}
