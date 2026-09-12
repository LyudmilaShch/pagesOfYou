import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database';
import { CreatePromoCodeDto, PromoCodeDiscountType } from './dto/create-promo-code.dto';
import type { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import type { GetPromoCodesQueryDto } from './dto/get-promo-codes-query.dto';

export interface PaginatedPromoCodes {
  items: Awaited<ReturnType<AdminPromoCodesService['findOne']>>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminPromoCodesService {
  private readonly logger = new Logger(AdminPromoCodesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ────────────────────────────────────────────────────────────────────

  async findAll(query: GetPromoCodesQueryDto): Promise<PaginatedPromoCodes> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = query.search
      ? { code: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const orderBy = { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.promoCode.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.promoCode.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Single ──────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const item = await this.prisma.promoCode.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException(`Promo code with id "${id}" not found.`);
    }

    return item;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreatePromoCodeDto) {
    this.assertPercentInRange(dto.discountType, dto.discountValue);
    await this.assertCodeUnique(dto.code);

    const item = await this.prisma.promoCode.create({
      data: {
        code: this.normalizeCode(dto.code),
        discountPercent: dto.discountType === PromoCodeDiscountType.PERCENT ? dto.discountValue : null,
        discountAmount: dto.discountType === PromoCodeDiscountType.AMOUNT ? dto.discountValue : null,
        isActive: dto.isActive ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimit ?? null,
      },
    });

    this.logger.log(`Promo code created: ${item.id} (${item.code})`);
    return item;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePromoCodeDto) {
    await this.findOne(id);

    const hasType = dto.discountType !== undefined;
    const hasValue = dto.discountValue !== undefined;
    if (hasType !== hasValue) {
      throw new BadRequestException('discountType and discountValue must be set together.');
    }
    if (hasType && hasValue) {
      this.assertPercentInRange(dto.discountType!, dto.discountValue!);
    }

    if (dto.code !== undefined) {
      await this.assertCodeUnique(dto.code, id);
    }

    const item = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: this.normalizeCode(dto.code) }),
        ...(hasType && hasValue && {
          discountPercent: dto.discountType === PromoCodeDiscountType.PERCENT ? dto.discountValue : null,
          discountAmount: dto.discountType === PromoCodeDiscountType.AMOUNT ? dto.discountValue : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      },
    });

    this.logger.log(`Promo code updated: ${id}`);
    return item;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /** A code that has already been used by at least one order can't be hard-deleted — that order
   * still references it (`Order.promoCodeId`). Deactivate it instead (`isActive: false`). */
  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);

    if (item.usageCount > 0) {
      throw new BadRequestException(
        'Промокод уже был использован — деактивируйте его вместо удаления.',
      );
    }

    await this.prisma.promoCode.delete({ where: { id } });
    this.logger.log(`Promo code deleted: ${id}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private assertPercentInRange(type: PromoCodeDiscountType, value: number): void {
    if (type === PromoCodeDiscountType.PERCENT && value > 100) {
      throw new BadRequestException('Процент скидки не может быть больше 100.');
    }
  }

  private async assertCodeUnique(code: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: this.normalizeCode(code) },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Промокод "${code}" уже существует.`);
    }
  }
}
