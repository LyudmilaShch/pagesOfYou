import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class SuggestListItemsDto {
  @ApiProperty({ description: 'Key of the LIST question to suggest items for' })
  @IsString()
  @MinLength(1)
  questionKey: string;

  @ApiProperty({ description: 'How many items to suggest (capped by the free rows of the journal\'s lists)' })
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  count: number;
}
