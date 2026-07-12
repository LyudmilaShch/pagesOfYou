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
import { AdminPhotoFramesService } from './admin-photo-frames.service';
import {
  CreatePhotoFrameDto,
  ReorderPhotoFramesDto,
  UpdatePhotoFrameDto,
} from './dto/photo-frame.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Photo Frames')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/photo-frames')
export class AdminPhotoFramesController {
  constructor(private readonly service: AdminPhotoFramesService) {}

  @Get()
  @ApiOperation({ summary: 'List photo frames' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get photo frame by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create photo frame' })
  create(@Body() dto: CreatePhotoFrameDto) {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder photo frames' })
  reorder(@Body() dto: ReorderPhotoFramesDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update photo frame' })
  update(@Param('id') id: string, @Body() dto: UpdatePhotoFrameDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete photo frame' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
