import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SpreadTemplatesService } from '../services/spread-templates.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catalog — Spread Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog/spread-templates')
export class SpreadTemplatesController {
  constructor(private readonly service: SpreadTemplatesService) {}

  @Get('by-type/:magazineTypeId')
  @ApiOperation({ summary: 'Get spread templates available for a magazine type' })
  findByMagazineType(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findByMagazineType(magazineTypeId);
  }
}
