import { Module } from '@nestjs/common';
import { AdminPhotoFramesController } from './admin-photo-frames.controller';
import { AdminPhotoFramesService } from './admin-photo-frames.service';

@Module({
  controllers: [AdminPhotoFramesController],
  providers: [AdminPhotoFramesService],
})
export class AdminPhotoFramesModule {}
