import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CatalogMagazineDefaultSpreadsService } from '../services/magazine-default-spreads.service';

@ApiTags('Catalog — Magazine Default Spreads')
@UseGuards(JwtAuthGuard)
@Controller('catalog/magazine-types/by-id')
export class CatalogMagazineDefaultSpreadsController {
  constructor(private readonly service: CatalogMagazineDefaultSpreadsService) {}

  @Public()
  @Get(':magazineTypeId/default-spreads')
  @ApiOperation({ summary: 'Get default spread templates configured for a magazine type' })
  findByMagazineType(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findByMagazineTypeId(magazineTypeId);
  }
}
