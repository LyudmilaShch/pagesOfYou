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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminMagazineTypesService } from './admin-magazine-types.service';
import { CreateMagazineTypeDto } from './dto/create-magazine-type.dto';
import { UpdateMagazineTypeDto } from './dto/update-magazine-type.dto';
import { GetMagazineTypesQueryDto } from './dto/get-magazine-types-query.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Magazine Types')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/magazine-types')
export class AdminMagazineTypesController {
  constructor(private readonly service: AdminMagazineTypesService) {}

  // ---------------------------------------------------------------------------
  // GET /admin/magazine-types
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'List magazine types (paginated)',
    description: 'Supports search, sorting and pagination. Returns all records including inactive.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list',
    schema: {
      example: {
        success: true,
        data: {
          items: [{ id: 'clx...', name: 'Журнал подруге', slug: 'friend', isActive: true }],
          total: 5,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  findAll(@Query() query: GetMagazineTypesQueryDto) {
    return this.service.findAll(query);
  }

  // ---------------------------------------------------------------------------
  // GET /admin/magazine-types/:id
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Get magazine type by id' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 200, description: 'Magazine type found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ---------------------------------------------------------------------------
  // POST /admin/magazine-types
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create magazine type' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  create(@Body() dto: CreateMagazineTypeDto) {
    return this.service.create(dto);
  }

  // ---------------------------------------------------------------------------
  // PATCH /admin/magazine-types/:id
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @ApiOperation({ summary: 'Update magazine type (partial)' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 200, description: 'Updated successfully' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Slug already in use' })
  update(@Param('id') id: string, @Body() dto: UpdateMagazineTypeDto) {
    return this.service.update(id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /admin/magazine-types/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete magazine type',
    description: 'Sets deletedAt timestamp. Record is preserved in the database.',
  })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 204, description: 'Deleted (soft)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
