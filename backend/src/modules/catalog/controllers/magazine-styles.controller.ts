import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MagazineStylesService } from '../services/magazine-styles.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog — Magazine Styles')
@UseGuards(JwtAuthGuard)
@Controller('catalog/magazine-styles')
export class MagazineStylesController {
  constructor(private readonly service: MagazineStylesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active magazine styles' })
  @ApiQuery({ name: 'magazineTypeId', required: false })
  findAll(@Query('magazineTypeId') magazineTypeId?: string) {
    return this.service.findAll(magazineTypeId);
  }
}
