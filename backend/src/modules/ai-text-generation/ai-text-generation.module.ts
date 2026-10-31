import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AiTextGenerationService } from './ai-text-generation.service';
import { AiTextsController } from './ai-texts.controller';
import { AiUsageService } from './ai-usage.service';
import { DraftAiTextsService } from './draft-ai-texts.service';

@Module({
  imports: [HttpModule],
  controllers: [AiTextsController],
  providers: [AiTextGenerationService, AiUsageService, DraftAiTextsService],
  exports: [AiTextGenerationService, AiUsageService],
})
export class AiTextGenerationModule {}
