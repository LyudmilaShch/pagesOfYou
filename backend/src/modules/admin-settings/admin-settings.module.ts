import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller';
import { SettingsController } from './settings.controller';
import { AdminSettingsService } from './admin-settings.service';

@Module({
  controllers: [AdminSettingsController, SettingsController],
  providers: [AdminSettingsService],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
