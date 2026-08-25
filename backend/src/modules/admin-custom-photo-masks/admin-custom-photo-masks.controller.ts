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
import { AdminCustomPhotoMasksService } from './admin-custom-photo-masks.service';
import {
  CreateCustomPhotoMaskDto,
  ReorderCustomPhotoMasksDto,
  UpdateCustomPhotoMaskDto,
} from './dto/custom-photo-mask.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Custom Photo Masks')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/custom-photo-masks')
export class AdminCustomPhotoMasksController {
  constructor(private readonly service: AdminCustomPhotoMasksService) {}

  @Get()
  @ApiOperation({ summary: 'List custom photo masks' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom photo mask by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create custom photo mask' })
  create(@Body() dto: CreateCustomPhotoMaskDto) {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder custom photo masks' })
  reorder(@Body() dto: ReorderCustomPhotoMasksDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update custom photo mask' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomPhotoMaskDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete custom photo mask' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
