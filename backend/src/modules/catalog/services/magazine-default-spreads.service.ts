import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';

const PAGE_SUMMARY = {
  id: true,
  name: true,
  pageType: true,
  previewImage: true,
} as const;

@Injectable()
export class CatalogMagazineDefaultSpreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findByMagazineTypeId(magazineTypeId: string) {
    const type = await this.prisma.magazineType.findFirst({
      where: { id: magazineTypeId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!type) {
      throw new NotFoundException('Magazine type not found.');
    }

    const spreads = await this.prisma.magazineDefaultSpread.findMany({
      where: { magazineTypeId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        layoutMode: true,
        magazinePageId: true,
        rightMagazinePageId: true,
        magazinePage: { select: PAGE_SUMMARY },
        rightMagazinePage: { select: PAGE_SUMMARY },
      },
    });

    const base = this.backendUrl();

    return spreads.map((spread) => ({
      id: spread.id,
      sortOrder: spread.sortOrder,
      layoutMode: spread.layoutMode,
      magazinePageId: spread.magazinePageId,
      rightMagazinePageId: spread.rightMagazinePageId,
      magazinePage: {
        ...spread.magazinePage,
        previewImage: resolveAssetUrl(spread.magazinePage.previewImage, base),
      },
      rightMagazinePage: spread.rightMagazinePage
        ? {
            ...spread.rightMagazinePage,
            previewImage: resolveAssetUrl(spread.rightMagazinePage.previewImage, base),
          }
        : null,
    }));
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }
}
