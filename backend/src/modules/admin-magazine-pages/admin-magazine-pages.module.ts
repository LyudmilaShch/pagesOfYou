import { Module } from '@nestjs/common';
import { AdminMagazineDefaultSpreadsController } from './admin-magazine-default-spreads.controller';
import { AdminMagazineDefaultSpreadsService } from './admin-magazine-default-spreads.service';
import { AdminMagazinePagesController } from './admin-magazine-pages.controller';
import { AdminMagazinePagesService } from './admin-magazine-pages.service';

@Module({
  controllers: [AdminMagazinePagesController, AdminMagazineDefaultSpreadsController],
  providers: [AdminMagazinePagesService, AdminMagazineDefaultSpreadsService],
  exports: [AdminMagazinePagesService, AdminMagazineDefaultSpreadsService],
})
export class AdminMagazinePagesModule {}
