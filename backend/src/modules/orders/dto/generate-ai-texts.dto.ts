import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class GenerateAiTextsDto {
  @ApiProperty({
    type: [String],
    description:
      'Question keys changed since the last generation — only matters for texts written before answers were fingerprinted',
  })
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  questionKeys: string[];
}
