import { Module } from '@nestjs/common';
import { AdminCustomPhotoMasksController } from './admin-custom-photo-masks.controller';
import { AdminCustomPhotoMasksService } from './admin-custom-photo-masks.service';

@Module({
  controllers: [AdminCustomPhotoMasksController],
  providers: [AdminCustomPhotoMasksService],
})
export class AdminCustomPhotoMasksModule {}
