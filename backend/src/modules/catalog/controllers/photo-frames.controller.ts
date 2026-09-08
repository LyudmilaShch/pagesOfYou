import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogPhotoFramesService } from '../services/photo-frames.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Catalog — Photo Frames')
@UseGuards(JwtAuthGuard)
@Controller('catalog/photo-frames')
export class CatalogPhotoFramesController {
  constructor(private readonly service: CatalogPhotoFramesService) {}

  // Public (not admin-only): the editor's photo frame picker is also reachable from
  // the customer-facing order-builder fill flow, which has no admin session.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active photo frames' })
  findAll() {
    return this.service.findAll();
  }
}
