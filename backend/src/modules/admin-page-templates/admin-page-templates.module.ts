import { Module } from '@nestjs/common';
import { AdminPageTemplatesController } from './admin-page-templates.controller';
import { AdminPageTemplatesService } from './admin-page-templates.service';

@Module({
  controllers: [AdminPageTemplatesController],
  providers: [AdminPageTemplatesService],
  exports: [AdminPageTemplatesService],
})
export class AdminPageTemplatesModule {}
