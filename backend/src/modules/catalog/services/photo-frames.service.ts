import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';

@Injectable()
export class CatalogPhotoFramesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    const items = await this.prisma.photoFrame.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      imageUrl: resolveAssetUrl(item.imageUrl, this.backendUrl()) as string,
    }));
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }
}
