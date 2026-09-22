import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { YandexStorageProvider } from '../../shared/storage/yandex-storage.provider';

@Module({
  controllers: [FilesController],
  providers: [FilesService, YandexStorageProvider],
  exports: [FilesService, YandexStorageProvider],
})
export class FilesModule {}
