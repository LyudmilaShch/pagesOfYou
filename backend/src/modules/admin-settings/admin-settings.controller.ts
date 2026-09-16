import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminSettingsService } from './admin-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@ApiTags('Admin — Settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly service: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform settings' })
  get() {
    return this.service.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Update platform settings (partial)' })
  update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.service.update(dto);
  }
}
