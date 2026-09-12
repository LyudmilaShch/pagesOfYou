import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';
import { hasCoverAndBackCoverTemplates } from '../../../shared/utils/magazine-type-availability.util';

/** Fields exposed on the public catalog endpoint */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  basePrice: true,
  oldPrice: true,
  includedSpreads: true,
  pricePerExtraFourPages: true,
  badgeType: true,
  badgeText: true,
  sortOrder: true,
  seoTitle: true,
  seoDescription: true,
} as const;

@Injectable()
export class MagazineTypesService {
  private readonly logger = new Logger(MagazineTypesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Public: return only active, non-deleted types sorted by sortOrder — and only ones that can
   * actually be ordered. `OrdersService.createDraft` requires at least one COVER and one
   * BACK_COVER template to exist; a type missing either would let a customer pick it here and
   * then hit a 400 the moment they try to start, so it's filtered out at the source instead. */
  async findAll() {
    const items = await this.prisma.magazineType.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        ...PUBLIC_SELECT,
        pages: {
          where: { deletedAt: null },
          select: { pageType: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return items
      .filter((item) => hasCoverAndBackCoverTemplates(item.pages))
      .map((item) => {
        const { pages, ...rest } = item;
        void pages;
        return this.withResolvedCoverImage(rest);
      });
  }

  /** Public: single type by slug */
  async findBySlug(slug: string) {
    const item = await this.prisma.magazineType.findUnique({
      where: { slug, deletedAt: null, isActive: true },
      select: {
        ...PUBLIC_SELECT,
        pages: {
          where: { deletedAt: null },
          select: { pageType: true },
        },
      },
    });

    if (!item || !hasCoverAndBackCoverTemplates(item.pages)) {
      throw new NotFoundException(`Magazine type "${slug}" not found.`);
    }

    const { pages, ...rest } = item;
    void pages;
    return this.withResolvedCoverImage(rest);
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedCoverImage<T extends { coverImage: string | null }>(item: T): T {
    return {
      ...item,
      coverImage: resolveAssetUrl(item.coverImage, this.backendUrl()),
    };
  }
}
