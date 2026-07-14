import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';
import { YandexStorageProvider } from './providers/yandex-storage.provider';

@Module({
  controllers: [AdminUploadsController],
  providers: [AdminUploadsService, YandexStorageProvider],
})
export class AdminUploadsModule {}
