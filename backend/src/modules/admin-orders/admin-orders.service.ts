import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl } from '../../common/utils/asset-url.util';
import { normalizeCanvasData } from '../../shared/types/canvas-data.types';
import { FilesService } from '../files/files.service';
import type { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import type { UploadOrderPhotoDto } from './dto/upload-order-photo.dto';
import type { SaveJournalPageCanvasDto } from '../orders/dto/save-journal-page-canvas.dto';

const MAGAZINE_PAGE_SUMMARY = {
  id: true,
  name: true,
  pageType: true,
  previewImage: true,
} as const;

const LIST_INCLUDE = {
  user: { select: { id: true, phone: true, name: true } },
  magazineType: { select: { id: true, name: true, coverImage: true } },
} satisfies Prisma.OrderInclude;

const DETAIL_INCLUDE = {
  user: { select: { id: true, phone: true, name: true, email: true } },
  magazineType: { select: { id: true, name: true, coverImage: true } },
  magazineStyle: { select: { id: true, name: true } },
  journalPages: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      magazinePage: { select: MAGAZINE_PAGE_SUMMARY },
      rightMagazinePage: { select: MAGAZINE_PAGE_SUMMARY },
      placeholderValues: true,
    },
  },
} satisfies Prisma.OrderInclude;

const JOURNAL_PAGE_INCLUDE = {
  magazinePage: { select: MAGAZINE_PAGE_SUMMARY },
  rightMagazinePage: { select: MAGAZINE_PAGE_SUMMARY },
  placeholderValues: true,
} satisfies Prisma.JournalPageInclude;

export interface PaginatedAdminOrders {
  items: Array<Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly filesService: FilesService,
  ) {}

  async findAll(query: GetOrdersQueryDto): Promise<PaginatedAdminOrders> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      // Default view is "placed orders" — a customer still shopping (DRAFT) isn't an order yet.
      status: query.status ?? { not: OrderStatus.DRAFT },
      ...(query.search
        ? {
            user: {
              OR: [
                { phone: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const orderBy = { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: LIST_INCLUDE, orderBy, skip, take: limit }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withResolvedAssets(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Order "${id}" not found.`);
    }

    return this.withResolvedAssets(order);
  }

  /** Full document (pageSnapshot + placeholderValues) for a single journal page — used to open a
   * placed order's spread in the same advanced per-element editor the customer used. */
  async getJournalPage(orderId: string, journalPageId: string) {
    await this.ensureOrderExists(orderId);

    const journalPage = await this.prisma.journalPage.findFirst({
      where: { id: journalPageId, orderId },
      include: JOURNAL_PAGE_INCLUDE,
    });

    if (!journalPage) {
      throw new NotFoundException(`Journal page "${journalPageId}" not found in this order.`);
    }

    return this.withResolvedJournalPage(journalPage);
  }

  /** Admin counterpart of `OrdersService.saveJournalPageCanvas` — not restricted to DRAFT orders
   * (an admin may need to touch the design while it's IN_DESIGN/DESIGN_REVIEW, after the customer
   * has already submitted), only blocked once the order is cancelled. */
  async saveJournalPageCanvas(orderId: string, journalPageId: string, dto: SaveJournalPageCanvasDto) {
    const order = await this.ensureOrderExists(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a cancelled order.');
    }

    const journalPage = await this.prisma.journalPage.findFirst({
      where: { id: journalPageId, orderId },
    });

    if (!journalPage) {
      throw new NotFoundException(`Journal page "${journalPageId}" not found in this order.`);
    }

    const normalized = normalizeCanvasData(dto.canvasData);

    await this.prisma.$transaction([
      this.prisma.placeholderValue.deleteMany({ where: { journalPageId } }),
      this.prisma.journalPage.update({
        where: { id: journalPageId },
        data: { pageSnapshot: normalized as unknown as Prisma.InputJsonValue },
      }),
    ]);

    return this.getJournalPage(orderId, journalPageId);
  }

  /** Photo gallery for this order — same "single photo bank for the whole journal" the customer
   * builds from, so an admin reviewing/fixing a design can see and reuse exactly what they
   * uploaded. */
  async listPhotos(orderId: string) {
    await this.ensureOrderExists(orderId);
    return this.filesService.listForAdmin(orderId);
  }

  async uploadPhoto(orderId: string, file: Express.Multer.File | undefined, dto: UploadOrderPhotoDto) {
    return this.filesService.registerAdminUpload(orderId, file, dto);
  }

  async setPhotoFavorite(orderId: string, fileId: string, isFavorite: boolean) {
    return this.filesService.setFavoriteForAdmin(orderId, fileId, isFavorite);
  }

  async deletePhoto(orderId: string, fileId: string): Promise<void> {
    await this.filesService.deleteForAdmin(orderId, fileId);
  }

  private async ensureOrderExists(orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });

    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found.`);
    }

    return order;
  }

  private withResolvedJournalPage<T extends Record<string, unknown>>(journalPage: T): T {
    const url = this.backendUrl();

    const resolveTemplate = (template: unknown) => {
      const summary = template as { previewImage?: string | null } | null | undefined;
      return summary
        ? { ...summary, previewImage: resolveAssetUrl(summary.previewImage ?? null, url) }
        : summary;
    };

    const placeholderValues = this.resolvePlaceholderValues(
      journalPage.placeholderValues as Array<Record<string, unknown>> | undefined,
    );

    return {
      ...journalPage,
      magazinePage: resolveTemplate(journalPage.magazinePage),
      rightMagazinePage: resolveTemplate(journalPage.rightMagazinePage),
      ...(placeholderValues ? { placeholderValues } : {}),
    };
  }

  private resolvePlaceholderValues(
    values: Array<Record<string, unknown>> | undefined,
  ): Array<Record<string, unknown>> | undefined {
    const url = this.backendUrl();

    return values?.map((value) => {
      if (value.valueType !== 'PHOTO' || !value.jsonValue) {
        return value;
      }

      const json = value.jsonValue as { url?: string };
      return { ...value, jsonValue: { ...json, url: resolveAssetUrl(json.url, url) } };
    });
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedAssets<T extends Record<string, unknown>>(order: T): T {
    const url = this.backendUrl();

    const magazineType = order.magazineType as { coverImage?: string | null } | undefined;
    const resolvedMagazineType = magazineType
      ? { ...magazineType, coverImage: resolveAssetUrl(magazineType.coverImage ?? null, url) }
      : magazineType;

    const journalPages = order.journalPages as Array<Record<string, unknown>> | undefined;
    const resolvedJournalPages = journalPages?.map((page) => {
      const resolveTemplate = (template: unknown) => {
        const summary = template as { previewImage?: string | null } | null | undefined;
        return summary
          ? { ...summary, previewImage: resolveAssetUrl(summary.previewImage ?? null, url) }
          : summary;
      };

      const placeholderValues = this.resolvePlaceholderValues(
        page.placeholderValues as Array<Record<string, unknown>> | undefined,
      );

      return {
        ...page,
        magazinePage: resolveTemplate(page.magazinePage),
        rightMagazinePage: resolveTemplate(page.rightMagazinePage),
        ...(placeholderValues ? { placeholderValues } : {}),
      };
    });

    return {
      ...order,
      ...(magazineType ? { magazineType: resolvedMagazineType } : {}),
      ...(journalPages ? { journalPages: resolvedJournalPages } : {}),
    };
  }
}
