import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AiTextGenerationService } from './ai-text-generation.service';

@Module({
  imports: [HttpModule],
  providers: [AiTextGenerationService],
  exports: [AiTextGenerationService],
})
export class AiTextGenerationModule {}
