import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminSettingsService } from './admin-settings.service';
import { Public } from '../../common/decorators/public.decorator';

/** Public read of the platform settings — e.g. the checkout page's production-time notice. */
@Public()
@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public platform settings' })
  get() {
    return this.service.get();
  }
}
