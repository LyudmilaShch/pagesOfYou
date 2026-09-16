import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database';
import type { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Always returns a row — creates the default one on first read. */
  async get() {
    return this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    const current = await this.get();
    const productionDaysMin = dto.productionDaysMin ?? current.productionDaysMin;
    const productionDaysMax = dto.productionDaysMax ?? current.productionDaysMax;

    if (productionDaysMax < productionDaysMin) {
      throw new BadRequestException(
        'Максимальный срок изготовления не может быть меньше минимального',
      );
    }

    return this.prisma.platformSettings.update({
      where: { id: SETTINGS_ID },
      data: { productionDaysMin, productionDaysMax },
    });
  }
}
