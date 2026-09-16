import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CdekController } from './cdek.controller';
import { CdekService } from './cdek.service';

@Module({
  imports: [HttpModule],
  controllers: [CdekController],
  providers: [CdekService],
  exports: [CdekService],
})
export class DeliveryCdekModule {}
