import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import type { CanvasData } from '../../../shared/types/canvas-data.types';

export class SaveJournalPageCanvasDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  canvasData?: CanvasData;
}
