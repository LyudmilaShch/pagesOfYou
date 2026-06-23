import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';

@Module({
  controllers: [AdminUploadsController],
  providers: [AdminUploadsService],
})
export class AdminUploadsModule {}
