import { Module } from '@nestjs/common';
import { AdminFontsController } from './admin-fonts.controller';
import { AdminFontsService } from './admin-fonts.service';

@Module({
  controllers: [AdminFontsController],
  providers: [AdminFontsService],
})
export class AdminFontsModule {}
