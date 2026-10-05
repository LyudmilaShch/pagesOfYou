import { Module } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { FilesModule } from '../files/files.module';
import { PdfExportModule } from '../pdf-export/pdf-export.module';

@Module({
  imports: [FilesModule, PdfExportModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
