import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MagazineTypesService } from '../services/magazine-types.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog — Magazine Types')
@UseGuards(JwtAuthGuard)
@Controller('catalog/magazine-types')
export class MagazineTypesController {
  constructor(private readonly service: MagazineTypesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active magazine types' })
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get magazine type by slug' })
  findOne(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}
