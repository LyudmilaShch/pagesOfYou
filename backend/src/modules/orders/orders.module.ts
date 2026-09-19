import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AiTextGenerationModule } from '../ai-text-generation/ai-text-generation.module';

@Module({
  imports: [AiTextGenerationModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
