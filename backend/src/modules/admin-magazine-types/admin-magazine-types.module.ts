import { Module } from '@nestjs/common';
import { AdminMagazineTypesController } from './admin-magazine-types.controller';
import { AdminMagazineTypesService } from './admin-magazine-types.service';

@Module({
  controllers: [AdminMagazineTypesController],
  providers: [AdminMagazineTypesService],
  exports: [AdminMagazineTypesService],
})
export class AdminMagazineTypesModule {}
