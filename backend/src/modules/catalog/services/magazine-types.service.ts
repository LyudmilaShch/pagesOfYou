import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';

/** Fields exposed on the public catalog endpoint */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  basePrice: true,
  oldPrice: true,
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

  /** Public: return only active, non-deleted types sorted by sortOrder */
  async findAll() {
    const items = await this.prisma.magazineType.findMany({
      where: { isActive: true, deletedAt: null },
      select: PUBLIC_SELECT,
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.withResolvedCoverImage(item));
  }

  /** Public: single type by slug */
  async findBySlug(slug: string) {
    const item = await this.prisma.magazineType.findUnique({
      where: { slug, deletedAt: null, isActive: true },
      select: PUBLIC_SELECT,
    });

    if (!item) throw new NotFoundException(`Magazine type "${slug}" not found.`);
    return this.withResolvedCoverImage(item);
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
