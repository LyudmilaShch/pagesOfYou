import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database';
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

  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.magazineType.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.magazineType.count({ where }),
    ]);

    return {
      items,
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
    });

    if (!item) {
      throw new NotFoundException(`Magazine type with id "${id}" not found.`);
    }

    return item;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateMagazineTypeDto) {
    await this.assertSlugUnique(dto.slug);

    const item = await this.prisma.magazineType.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        coverImage: dto.coverImage,
        basePrice: dto.basePrice ?? null,
        oldPrice: dto.oldPrice ?? null,
        badgeType: dto.badgeType ?? null,
        badgeText: dto.badgeText ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
    });

    this.logger.log(`Magazine type created: ${item.id} (${item.slug})`);
    return item;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateMagazineTypeDto) {
    await this.findOne(id);

    if (dto.slug) {
      await this.assertSlugUnique(dto.slug, id);
    }

    const item = await this.prisma.magazineType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.oldPrice !== undefined && { oldPrice: dto.oldPrice ?? null }),
        ...(dto.badgeType !== undefined && { badgeType: dto.badgeType ?? null }),
        ...(dto.badgeText !== undefined && { badgeText: dto.badgeText ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle }),
        ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription }),
      },
    });

    this.logger.log(`Magazine type updated: ${item.id}`);
    return item;
  }

  // ── Soft Delete ─────────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.magazineType.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`Magazine type soft-deleted: ${id}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.magazineType.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }
}
