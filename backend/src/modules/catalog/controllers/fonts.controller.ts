import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FontsService } from '../services/fonts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog — Fonts')
@UseGuards(JwtAuthGuard)
@Controller('catalog/fonts')
export class FontsController {
  constructor(private readonly service: FontsService) {}

  // Public (not admin-only): the editor's font picker is also reachable from
  // the customer-facing order-builder fill flow, which has no admin session.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active custom fonts' })
  findAll() {
    return this.service.findAll();
  }
}
