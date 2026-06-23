import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SpreadDesignsService } from '../services/spread-designs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catalog — Spread Designs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog/spread-designs')
export class SpreadDesignsController {
  constructor(private readonly service: SpreadDesignsService) {}

  @Get()
  @ApiOperation({ summary: 'Get spread designs by template and style' })
  @ApiQuery({ name: 'spreadTemplateId', required: true })
  @ApiQuery({ name: 'styleId', required: true })
  findAll(
    @Query('spreadTemplateId') spreadTemplateId: string,
    @Query('styleId') styleId: string,
  ) {
    return this.service.findByTemplateAndStyle(spreadTemplateId, styleId);
  }

  @Get(':id/fields')
  @ApiOperation({ summary: 'Get spread design with all field definitions' })
  findWithFields(@Param('id') id: string) {
    return this.service.findByIdWithFields(id);
  }
}
