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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminPromoCodesService } from './admin-promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { GetPromoCodesQueryDto } from './dto/get-promo-codes-query.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Promo Codes')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/promo-codes')
export class AdminPromoCodesController {
  constructor(private readonly service: AdminPromoCodesService) {}

  @Get()
  @ApiOperation({ summary: 'List promo codes (paginated)' })
  findAll(@Query() query: GetPromoCodesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promo code by id' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create promo code' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  create(@Body() dto: CreatePromoCodeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update promo code (partial)' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete promo code',
    description: 'Only allowed if the code has never been used — otherwise deactivate it instead.',
  })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Code has already been used' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
