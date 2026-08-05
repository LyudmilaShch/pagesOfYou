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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminFontsService } from './admin-fonts.service';
import { CreateFontDto, ReorderFontsDto, UpdateFontDto } from './dto/font.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Fonts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/fonts')
export class AdminFontsController {
  constructor(private readonly service: AdminFontsService) {}

  @Get()
  @ApiOperation({ summary: 'List fonts' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get font by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create font' })
  create(@Body() dto: CreateFontDto) {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder fonts' })
  reorder(@Body() dto: ReorderFontsDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update font' })
  update(@Param('id') id: string, @Body() dto: UpdateFontDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete font' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
