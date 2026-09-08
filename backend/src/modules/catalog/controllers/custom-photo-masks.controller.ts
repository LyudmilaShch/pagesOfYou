import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogCustomPhotoMasksService } from '../services/custom-photo-masks.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog — Custom Photo Masks')
@UseGuards(JwtAuthGuard)
@Controller('catalog/custom-photo-masks')
export class CatalogCustomPhotoMasksController {
  constructor(private readonly service: CatalogCustomPhotoMasksService) {}

  // Public (not admin-only): the editor's photo mask picker is also reachable from
  // the customer-facing order-builder fill flow, which has no admin session.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active custom photo masks' })
  findAll() {
    return this.service.findAll();
  }
}
