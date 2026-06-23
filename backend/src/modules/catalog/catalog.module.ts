import { Module } from '@nestjs/common';
import { MagazineTypesController } from './controllers/magazine-types.controller';
import { MagazineStylesController } from './controllers/magazine-styles.controller';
import { SpreadTemplatesController } from './controllers/spread-templates.controller';
import { SpreadDesignsController } from './controllers/spread-designs.controller';
import { MagazineTypesService } from './services/magazine-types.service';
import { MagazineStylesService } from './services/magazine-styles.service';
import { SpreadTemplatesService } from './services/spread-templates.service';
import { SpreadDesignsService } from './services/spread-designs.service';

@Module({
  controllers: [
    MagazineTypesController,
    MagazineStylesController,
    SpreadTemplatesController,
    SpreadDesignsController,
  ],
  providers: [
    MagazineTypesService,
    MagazineStylesService,
    SpreadTemplatesService,
    SpreadDesignsService,
  ],
  exports: [MagazineTypesService, MagazineStylesService, SpreadDesignsService],
})
export class CatalogModule {}
