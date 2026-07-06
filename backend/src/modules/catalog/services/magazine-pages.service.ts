import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';
import { normalizeCanvasData } from '../../../shared/types/canvas-data.types';

const PUBLIC_PAGE_SELECT = {
  id: true,
  name: true,
  description: true,
  pageType: true,
  sortOrder: true,
  previewImage: true,
  canvasData: true,
  isRequired: true,
} as const;

@Injectable()
export class CatalogMagazinePagesService {
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

    const pages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId, deletedAt: null },
      select: PUBLIC_PAGE_SELECT,
      orderBy: { sortOrder: 'asc' },
    });

    return pages.map((page) => ({
      ...page,
      previewImage: this.resolvePreview(page.previewImage),
      canvasData: normalizeCanvasData(page.canvasData),
    }));
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private resolvePreview(previewImage: string | null): string | null {
    return resolveAssetUrl(previewImage, this.backendUrl());
  }
}
