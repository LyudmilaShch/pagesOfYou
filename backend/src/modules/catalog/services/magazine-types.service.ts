import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database';

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

  constructor(private readonly prisma: PrismaService) {}

  /** Public: return only active, non-deleted types sorted by sortOrder */
  async findAll() {
    return this.prisma.magazineType.findMany({
      where: { isActive: true, deletedAt: null },
      select: PUBLIC_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Public: single type by slug */
  async findBySlug(slug: string) {
    const item = await this.prisma.magazineType.findUnique({
      where: { slug, deletedAt: null, isActive: true },
      select: PUBLIC_SELECT,
    });

    if (!item) throw new NotFoundException(`Magazine type "${slug}" not found.`);
    return item;
  }
}
