import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PageType } from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl, toStoredAssetPath } from '../../common/utils/asset-url.util';
import { hasCoverAndBackCoverTemplates } from '../../shared/utils/magazine-type-availability.util';
import type { CreateMagazineTypeDto } from './dto/create-magazine-type.dto';
import type { UpdateMagazineTypeDto } from './dto/update-magazine-type.dto';
import type { GetMagazineTypesQueryDto } from './dto/get-magazine-types-query.dto';

export interface PaginatedMagazineTypes {
  items: Awaited<ReturnType<AdminMagazineTypesService['findOne']>>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminMagazineTypesService {
  private readonly logger = new Logger(AdminMagazineTypesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── List ────────────────────────────────────────────────────────────────────

  async findAll(query: GetMagazineTypesQueryDto): Promise<PaginatedMagazineTypes> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const orderBy = { [query.sortBy ?? 'sortOrder']: query.sortOrder ?? 'asc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.magazineType.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { pages: { where: { deletedAt: null }, select: { pageType: true } } },
      }),
      this.prisma.magazineType.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withResolvedCoverImage(this.withAvailability(item))),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Single ──────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const item = await this.prisma.magazineType.findUnique({
      where: { id, deletedAt: null },
      include: { pages: { where: { deletedAt: null }, select: { pageType: true } } },
    });

    if (!item) {
      throw new NotFoundException(`Magazine type with id "${id}" not found.`);
    }

    return this.withResolvedCoverImage(this.withAvailability(item));
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateMagazineTypeDto) {
    await this.assertSlugUnique(dto.slug);
    this.assertEvenIncludedSpreads(dto.includedSpreads);

    const item = await this.prisma.magazineType.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        coverImage: toStoredAssetPath(dto.coverImage),
        basePrice: dto.basePrice ?? null,
        oldPrice: dto.oldPrice ?? null,
        includedSpreads: dto.includedSpreads ?? 8,
        pricePerExtraFourPages: dto.pricePerExtraFourPages ?? null,
        badgeType: dto.badgeType ?? null,
        badgeText: dto.badgeText ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
    });

    this.logger.log(`Magazine type created: ${item.id} (${item.slug})`);
    // Re-fetch through `findOne` rather than resolving `item` directly, so the response carries
    // `isAvailableToCustomers` too (always false right after creation — no pages yet — but this
    // keeps every response shape from this service consistent instead of a one-off omission here).
    return this.findOne(item.id);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateMagazineTypeDto) {
    await this.findOne(id);

    if (dto.slug) {
      await this.assertSlugUnique(dto.slug, id);
    }
    this.assertEvenIncludedSpreads(dto.includedSpreads);

    const item = await this.prisma.magazineType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImage !== undefined && {
          coverImage: toStoredAssetPath(dto.coverImage),
        }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.oldPrice !== undefined && { oldPrice: dto.oldPrice ?? null }),
        ...(dto.includedSpreads !== undefined && { includedSpreads: dto.includedSpreads }),
        ...(dto.pricePerExtraFourPages !== undefined && {
          pricePerExtraFourPages: dto.pricePerExtraFourPages ?? null,
        }),
        ...(dto.badgeType !== undefined && { badgeType: dto.badgeType ?? null }),
        ...(dto.badgeText !== undefined && { badgeText: dto.badgeText ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle }),
        ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription }),
      },
    });

    this.logger.log(`Magazine type updated: ${item.id}`);
    // See the matching comment in `create()` — keeps `isAvailableToCustomers` accurate.
    return this.findOne(item.id);
  }

  // ── Soft Delete ─────────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.magazinePage.updateMany({
        where: { magazineTypeId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.magazineType.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    this.logger.log(`Magazine type soft-deleted: ${id}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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

  /** Whether this type has at least one COVER and one BACK_COVER template — the minimum
   * `OrdersService.createDraft` requires, and what the public catalog (`MagazineTypesService`)
   * uses to decide whether to show this type to customers at all. Surfaced here so admins can see
   * *why* a type is invisible on the site instead of it silently never appearing. */
  private withAvailability<T extends { pages: Array<{ pageType: PageType }> }>(
    item: T,
  ): Omit<T, 'pages'> & { isAvailableToCustomers: boolean } {
    const { pages, ...rest } = item;
    return { ...rest, isAvailableToCustomers: hasCoverAndBackCoverTemplates(pages) };
  }

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.magazineType.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  /** Printing requires page counts in multiples of 4 — spreads are always added/counted in pairs
   * (`OrdersService.addJournalSpread`, `MIN_JOURNAL_SPREADS`), so the number of spreads a type's
   * base price covers must be even too, or the pricing math (`calculateJournalPriceBreakdown`)
   * would never land on a whole extra-4-pages unit. */
  private assertEvenIncludedSpreads(includedSpreads: number | undefined): void {
    if (includedSpreads !== undefined && includedSpreads % 2 !== 0) {
      throw new BadRequestException('includedSpreads must be even (page counts are multiples of 4).');
    }
  }
}
