import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminMagazinePagesService } from './admin-magazine-pages.service';
import {
  CreateMagazinePageDto,
  DuplicateMagazinePageDto,
  ReorderMagazinePagesDto,
  UpdateMagazinePageDto,
} from './dto/magazine-page.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Magazine Pages')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/magazine-types/:magazineTypeId/pages')
export class AdminMagazinePagesController {
  constructor(private readonly service: AdminMagazinePagesService) {}

  @Get()
  @ApiOperation({ summary: 'List pages for a magazine type' })
  @ApiParam({ name: 'magazineTypeId' })
  findAll(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findAllByMagazineType(magazineTypeId);
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Get magazine page by id' })
  findOne(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.service.findOne(magazineTypeId, pageId);
  }

  @Post()
  @ApiOperation({ summary: 'Create magazine page' })
  create(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: CreateMagazinePageDto,
  ) {
    return this.service.create(magazineTypeId, dto);
  }

  @Post(':pageId/duplicate')
  @ApiOperation({ summary: 'Duplicate magazine page (optionally into another magazine type)' })
  duplicate(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('pageId') pageId: string,
    @Body() dto: DuplicateMagazinePageDto,
  ) {
    return this.service.duplicate(magazineTypeId, pageId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder magazine pages' })
  reorder(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: ReorderMagazinePagesDto,
  ) {
    return this.service.reorder(magazineTypeId, dto);
  }

  @Patch(':pageId')
  @ApiOperation({ summary: 'Update magazine page' })
  update(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('pageId') pageId: string,
    @Body() dto: UpdateMagazinePageDto,
  ) {
    return this.service.update(magazineTypeId, pageId, dto);
  }

  @Delete(':pageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete magazine page' })
  remove(
    @Param('magazineTypeId') magazineTypeId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.service.remove(magazineTypeId, pageId);
  }
}
