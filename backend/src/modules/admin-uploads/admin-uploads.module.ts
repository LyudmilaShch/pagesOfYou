import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [AdminUploadsController],
  providers: [AdminUploadsService],
})
export class AdminUploadsModule {}
