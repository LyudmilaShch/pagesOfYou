import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CatalogMagazinePagesService } from '../services/magazine-pages.service';

@ApiTags('Catalog — Magazine Pages')
@UseGuards(JwtAuthGuard)
@Controller('catalog/magazine-types/by-id')
export class CatalogMagazinePagesController {
  constructor(private readonly service: CatalogMagazinePagesService) {}

  @Public()
  @Get(':magazineTypeId/pages')
  @ApiOperation({ summary: 'Get magazine pages for a type (read-only template preview)' })
  findByMagazineType(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findByMagazineTypeId(magazineTypeId);
  }
}
