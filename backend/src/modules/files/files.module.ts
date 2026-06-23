import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { R2StorageProvider } from './providers/r2-storage.provider';

@Module({
  controllers: [FilesController],
  providers: [FilesService, R2StorageProvider],
  exports: [FilesService, R2StorageProvider],
})
export class FilesModule {}
