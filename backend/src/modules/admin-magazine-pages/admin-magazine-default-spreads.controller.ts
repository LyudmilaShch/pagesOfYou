import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { AdminMagazineDefaultSpreadsService } from './admin-magazine-default-spreads.service';
import { DuplicateDefaultSpreadDto, SetMagazineDefaultSpreadsDto } from './dto/default-spreads.dto';

@Public()
@ApiTags('Admin — Magazine Default Spreads')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/magazine-types/:magazineTypeId/default-spreads')
export class AdminMagazineDefaultSpreadsController {
  constructor(private readonly service: AdminMagazineDefaultSpreadsService) {}

  @Get()
  @ApiOperation({ summary: 'List default spread templates for a magazine type' })
  @ApiParam({ name: 'magazineTypeId' })
  findAll(@Param('magazineTypeId') magazineTypeId: string) {
    return this.service.findByMagazineTypeId(magazineTypeId);
  }

  @Put()
  @ApiOperation({ summary: 'Replace default spread templates (min 8)' })
  replace(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: SetMagazineDefaultSpreadsDto,
  ) {
    return this.service.replaceForMagazineType(magazineTypeId, dto);
  }

  @Post('duplicate-to-type')
  @ApiOperation({
    summary: 'Duplicate a default spread (and its page templates) into another magazine type',
  })
  duplicateToType(
    @Param('magazineTypeId') magazineTypeId: string,
    @Body() dto: DuplicateDefaultSpreadDto,
  ) {
    return this.service.duplicateToType(magazineTypeId, dto);
  }
}
