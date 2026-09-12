import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryMethod,
  JournalSpreadLayout,
  OrderStatus,
  PageType,
  PlaceholderValueType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl } from '../../common/utils/asset-url.util';
import { MIN_JOURNAL_SPREADS } from '../../shared/constants/journal.constants';
import { normalizeCanvasData } from '../../shared/types/canvas-data.types';
import { flattenTree } from '../../shared/utils/element-tree.util';
import { calculateJournalPrice } from '../../shared/utils/pricing.util';
import {
  buildInitialJournalSlots,
  buildJournalPageSnapshot,
  countSpreadSlots,
  groupTemplatesByPageType,
  pickDefaultSpreadTemplate,
  type JournalSlotDraft,
} from '../../shared/utils/journal-structure.util';
import {
  isFillableElement,
  isPlaceholderFilled,
  resolvePlaceholderValueType,
} from '../../shared/utils/placeholder.util';
import type { ApplyPromoCodeDto } from './dto/apply-promo-code.dto';
import type { CalculateDeliveryDto } from './dto/calculate-delivery.dto';
import type { CreateDraftOrderDto, CreateOrderJournalPageDto } from './dto/create-draft-order.dto';
import type { ReorderJournalSpreadsDto } from './dto/reorder-journal-spreads.dto';
import type { SaveJournalPageCanvasDto } from './dto/save-journal-page-canvas.dto';
import type { SetJournalPageTemplateDto } from './dto/set-journal-page-template.dto';
import type { UpsertPlaceholdersDto } from './dto/upsert-placeholders.dto';

const MAGAZINE_PAGE_SUMMARY = {
  id: true,
  name: true,
  pageType: true,
  previewImage: true,
  isRequired: true,
} as const;

const ORDER_INCLUDE = {
  magazineType: {
    select: {
      id: true,
      name: true,
      slug: true,
      coverImage: true,
      basePrice: true,
      oldPrice: true,
      includedSpreads: true,
      pricePerExtraFourPages: true,
    },
  },
  promoCode: {
    select: { code: true },
  },
  journalPages: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      magazinePage: {
        select: MAGAZINE_PAGE_SUMMARY,
      },
      rightMagazinePage: {
        select: MAGAZINE_PAGE_SUMMARY,
      },
      placeholderValues: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createDraft(userId: string, dto: CreateDraftOrderDto) {
    const magazineType = await this.prisma.magazineType.findFirst({
      where: {
        id: dto.magazineTypeId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!magazineType) {
      throw new NotFoundException('Magazine type not found or inactive.');
    }

    const templatePages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId: dto.magazineTypeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    if (templatePages.length === 0) {
      throw new BadRequestException(
        'This magazine type has no page templates configured yet.',
      );
    }

    const catalog = groupTemplatesByPageType(templatePages);
    if (catalog.cover.length === 0 || catalog.backCover.length === 0) {
      throw new BadRequestException(
        'Magazine type must have at least one cover and one back cover template.',
      );
    }

    const journalSlots: JournalSlotDraft[] =
      dto.journalPages && dto.journalPages.length > 0
        ? this.buildJournalSlotsFromDto(dto.journalPages, templatePages)
        : buildInitialJournalSlots(templatePages, {
            configuredSpreads: await this.loadConfiguredSpreads(dto.magazineTypeId),
          });

    const styleLink = await this.prisma.magazineTypeStyle.findFirst({
      where: { magazineTypeId: dto.magazineTypeId },
      orderBy: { sortOrder: 'asc' },
      select: { magazineStyleId: true },
    });

    const totalPrice = calculateJournalPrice(magazineType, countSpreadSlots(journalSlots));

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          magazineTypeId: dto.magazineTypeId,
          magazineStyleId: styleLink?.magazineStyleId ?? null,
          status: OrderStatus.DRAFT,
          totalPrice,
          magazineTypeSnapshot: {
            id: magazineType.id,
            name: magazineType.name,
            slug: magazineType.slug,
            basePrice: magazineType.basePrice,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.journalPage.createMany({
        data: journalSlots.map((slot) => ({
          orderId: created.id,
          magazinePageId: slot.magazinePageId,
          rightMagazinePageId: slot.rightMagazinePageId,
          slotType: slot.slotType,
          layoutMode: slot.layoutMode,
          sortOrder: slot.sortOrder,
          pageSnapshot: slot.pageSnapshot as unknown as Prisma.InputJsonValue,
        })),
      });

      return created;
    });

    this.logger.log(`Draft order created: ${order.id} for user ${userId}`);
    return this.findOne(order.id, userId);
  }

  /** Turns an already-assembled set of journal pages (a guest's local draft, built entirely
   * client-side) into the slot shape `createDraft` persists — validated against this magazine
   * type's own templates rather than trusted blindly, since the caller is an ordinary
   * (non-admin) user. */
  private buildJournalSlotsFromDto(
    pages: CreateOrderJournalPageDto[],
    templatePages: Array<{ id: string }>,
  ): JournalSlotDraft[] {
    const validTemplateIds = new Set(templatePages.map((page) => page.id));

    for (const page of pages) {
      if (!validTemplateIds.has(page.magazinePageId)) {
        throw new BadRequestException(
          `Unknown template "${page.magazinePageId}" for this magazine type.`,
        );
      }
      if (page.rightMagazinePageId && !validTemplateIds.has(page.rightMagazinePageId)) {
        throw new BadRequestException(
          `Unknown template "${page.rightMagazinePageId}" for this magazine type.`,
        );
      }
    }

    const hasCover = pages.some((page) => page.slotType === PageType.COVER);
    const hasBackCover = pages.some((page) => page.slotType === PageType.BACK_COVER);
    if (!hasCover || !hasBackCover) {
      throw new BadRequestException('Journal must include a cover and a back cover.');
    }

    if (countSpreadSlots(pages) < MIN_JOURNAL_SPREADS) {
      throw new BadRequestException(
        `Journal must contain at least ${MIN_JOURNAL_SPREADS} spreads.`,
      );
    }

    return pages.map((page) => ({
      slotType: page.slotType,
      layoutMode: page.layoutMode ?? null,
      magazinePageId: page.magazinePageId,
      rightMagazinePageId: page.rightMagazinePageId ?? null,
      sortOrder: page.sortOrder,
      pageSnapshot: normalizeCanvasData(page.pageSnapshot),
    }));
  }

  async findAllByUser(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          magazineType: {
            select: { id: true, name: true, coverImage: true },
          },
          // The account page renders each journal's actual cover (via `JournalSpreadThumbnail`,
          // same as the "Структура" panel/admin order review) instead of the magazine *type*'s
          // static marketing image — a customer's own cover almost always looks different from
          // the type's generic catalog photo once they've personalized it.
          journalPages: {
            where: { slotType: PageType.COVER },
            take: 1,
            select: { id: true, pageSnapshot: true, placeholderValues: true },
          },
        },
      }),
      this.prisma.order.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      items: items.map((item) => this.withResolvedAssets(item)),
      total,
      page,
      limit,
    };
  }

  async findOne(orderId: string, userId: string) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId, ORDER_INCLUDE);
    return this.withResolvedAssets(order);
  }

  async upsertPlaceholders(
    orderId: string,
    journalPageId: string,
    userId: string,
    dto: UpsertPlaceholdersDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const journalPage = await this.prisma.journalPage.findFirst({
      where: { id: journalPageId, orderId },
      include: { placeholderValues: true },
    });

    if (!journalPage) {
      throw new NotFoundException('Journal page not found in this order.');
    }

    const canvas = normalizeCanvasData(journalPage.pageSnapshot);
    const elementMap = new Map(flattenTree(canvas.elements).map((element) => [element.id, element]));

    for (const input of dto.values) {
      const element = elementMap.get(input.elementId);

      if (!element || !isFillableElement(element)) {
        throw new BadRequestException(
          `Element "${input.elementId}" is not a fillable placeholder.`,
        );
      }

      const expectedType = resolvePlaceholderValueType(element);
      if (input.valueType !== expectedType) {
        throw new BadRequestException(
          `Invalid value type for element "${input.elementId}".`,
        );
      }

      const existing = journalPage.placeholderValues.find(
        (value) => value.elementId === input.elementId,
      );

      const isEmpty =
        expectedType === PlaceholderValueType.PHOTO
          ? !(input.jsonValue as { url?: string } | undefined)?.url?.trim()
          : !input.textValue?.trim();

      if (isEmpty) {
        if (existing) {
          await this.prisma.placeholderValue.delete({ where: { id: existing.id } });
        }
        continue;
      }

      const data = {
        valueType: input.valueType,
        textValue: input.textValue?.trim() || null,
        jsonValue:
          input.jsonValue !== undefined
            ? (input.jsonValue as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      };

      if (existing) {
        await this.prisma.placeholderValue.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.placeholderValue.create({
          data: {
            journalPageId,
            elementId: input.elementId,
            ...data,
          },
        });
      }
    }

    return this.findOne(orderId, userId);
  }

  /**
   * Full-document save used by the advanced (per-element) journal page editor — unlike
   * `upsertPlaceholders`, this is not restricted to fillable elements/value types. Once a page has
   * gone through this path its `pageSnapshot` is the sole source of truth, so any prior
   * `PlaceholderValue` diffs are cleared to avoid the simple mode re-applying stale overrides.
   */
  async saveJournalPageCanvas(
    orderId: string,
    journalPageId: string,
    userId: string,
    dto: SaveJournalPageCanvasDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const journalPage = await this.prisma.journalPage.findFirst({
      where: { id: journalPageId, orderId },
    });

    if (!journalPage) {
      throw new NotFoundException('Journal page not found in this order.');
    }

    const normalized = normalizeCanvasData(dto.canvasData);

    await this.prisma.$transaction([
      this.prisma.placeholderValue.deleteMany({ where: { journalPageId } }),
      this.prisma.journalPage.update({
        where: { id: journalPageId },
        data: { pageSnapshot: normalized as unknown as Prisma.InputJsonValue },
      }),
    ]);

    return this.findOne(orderId, userId);
  }

  async submit(orderId: string, userId: string) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId, ORDER_INCLUDE);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be submitted.');
    }

    const spreadCount = countSpreadSlots(order.journalPages);
    if (spreadCount < MIN_JOURNAL_SPREADS) {
      throw new BadRequestException(
        `Journal must contain at least ${MIN_JOURNAL_SPREADS} spreads.`,
      );
    }

    const missing = this.collectMissingRequiredPlaceholders(order);

    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Required placeholders are not filled.',
        missing,
      });
    }

    if (!order.deliveryMethod) {
      throw new BadRequestException('Укажите способ и адрес доставки.');
    }

    const submitted = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: ORDER_INCLUDE,
    });

    await this.prisma.orderEvent.create({
      data: {
        orderId,
        type: 'SUBMITTED',
        actorId: userId,
        metadata: { from: OrderStatus.DRAFT, to: OrderStatus.SUBMITTED },
      },
    });

    this.logger.log(`Order submitted: ${orderId}`);
    return this.withResolvedAssets(submitted);
  }

  /** Adds 2 spreads (= 4 pages) at once, never 1 — printing requires page counts in multiples of
   * 4 (signature/tetrad binding), so the journal's page count must stay even in spreads too. */
  async addJournalSpread(orderId: string, userId: string) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId, ORDER_INCLUDE);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const templatePages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId: order.magazineTypeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    const configuredSpreads = await this.loadConfiguredSpreads(order.magazineTypeId);
    const spreadDefault =
      configuredSpreads?.at(-1) ??
      pickDefaultSpreadTemplate(groupTemplatesByPageType(templatePages));
    if (!spreadDefault) {
      throw new BadRequestException('No spread templates available for this magazine type.');
    }

    const backCoverIndex = order.journalPages.findIndex(
      (page) => page.slotType === PageType.BACK_COVER,
    );
    const insertSortOrder =
      backCoverIndex === -1
        ? order.journalPages.length
        : order.journalPages[backCoverIndex].sortOrder;

    const SPREADS_PER_ADD = 2;
    const newSpreadCount = countSpreadSlots(order.journalPages) + SPREADS_PER_ADD;
    const totalPrice = calculateJournalPrice(order.magazineType, newSpreadCount);

    await this.prisma.$transaction(async (tx) => {
      await tx.journalPage.updateMany({
        where: {
          orderId,
          sortOrder: { gte: insertSortOrder },
        },
        data: {
          sortOrder: { increment: SPREADS_PER_ADD },
        },
      });

      const primaryTemplate = templatePages.find(
        (page) => page.id === spreadDefault.magazinePageId,
      );
      const rightTemplate = spreadDefault.rightMagazinePageId
        ? templatePages.find((page) => page.id === spreadDefault.rightMagazinePageId)
        : null;

      const pageSnapshot = buildJournalPageSnapshot(
        PageType.SPREAD,
        spreadDefault.layoutMode,
        primaryTemplate ?? null,
        rightTemplate ?? null,
      ) as unknown as Prisma.InputJsonValue;

      await tx.journalPage.createMany({
        data: Array.from({ length: SPREADS_PER_ADD }, (_, i) => ({
          orderId,
          slotType: PageType.SPREAD,
          layoutMode: spreadDefault.layoutMode,
          magazinePageId: spreadDefault.magazinePageId,
          rightMagazinePageId: spreadDefault.rightMagazinePageId,
          sortOrder: insertSortOrder + i,
          pageSnapshot,
        })),
      });

      await tx.order.update({
        where: { id: orderId },
        data: { totalPrice },
      });
    });

    return this.findOne(orderId, userId);
  }

  async reorderJournalSpreads(
    orderId: string,
    userId: string,
    dto: ReorderJournalSpreadsDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId, ORDER_INCLUDE);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const cover = order.journalPages.find((page) => page.slotType === PageType.COVER);
    const backCover = order.journalPages.find((page) => page.slotType === PageType.BACK_COVER);
    const spreads = order.journalPages.filter((page) => page.slotType === PageType.SPREAD);

    if (!cover || !backCover) {
      throw new BadRequestException('Journal structure is invalid.');
    }

    if (dto.spreadIds.length !== spreads.length) {
      throw new BadRequestException('Spread reorder list must include all spread slots.');
    }

    const spreadIdSet = new Set(spreads.map((page) => page.id));
    for (const id of dto.spreadIds) {
      if (!spreadIdSet.has(id)) {
        throw new BadRequestException(`Journal spread "${id}" not found in this order.`);
      }
    }

    const orderedSpreads = dto.spreadIds.map((id) => spreads.find((page) => page.id === id)!);
    const nextOrder = [cover, ...orderedSpreads, backCover];

    await this.prisma.$transaction(
      nextOrder.map((page, index) =>
        this.prisma.journalPage.update({
          where: { id: page.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.findOne(orderId, userId);
  }

  async setJournalPageTemplate(
    orderId: string,
    journalPageId: string,
    userId: string,
    dto: SetJournalPageTemplateDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const journalPage = await this.prisma.journalPage.findFirst({
      where: { id: journalPageId, orderId },
    });

    if (!journalPage) {
      throw new NotFoundException('Journal page not found in this order.');
    }

    const primaryTemplate = await this.prisma.magazinePage.findFirst({
      where: {
        id: dto.magazinePageId,
        magazineTypeId: order.magazineTypeId,
        deletedAt: null,
      },
    });

    if (!primaryTemplate) {
      throw new NotFoundException('Template page not found.');
    }

    let layoutMode = dto.layoutMode ?? journalPage.layoutMode;
    let rightTemplate = null as Awaited<ReturnType<typeof this.prisma.magazinePage.findFirst>>;

    if (journalPage.slotType === PageType.SPREAD) {
      layoutMode = dto.layoutMode ?? layoutMode ?? JournalSpreadLayout.SPREAD;

      if (layoutMode === JournalSpreadLayout.SPREAD) {
        if (primaryTemplate.pageType !== PageType.SPREAD) {
          throw new BadRequestException('Spread layout requires a SPREAD template.');
        }
      } else {
        if (primaryTemplate.pageType !== PageType.PAGE) {
          throw new BadRequestException('Split layout requires PAGE templates.');
        }

        if (!dto.rightMagazinePageId) {
          throw new BadRequestException('Right page template is required for split layout.');
        }

        rightTemplate = await this.prisma.magazinePage.findFirst({
          where: {
            id: dto.rightMagazinePageId,
            magazineTypeId: order.magazineTypeId,
            deletedAt: null,
            pageType: PageType.PAGE,
          },
        });

        if (!rightTemplate) {
          throw new NotFoundException('Right page template not found.');
        }
      }
    } else if (journalPage.slotType === PageType.COVER) {
      if (primaryTemplate.pageType !== PageType.COVER) {
        throw new BadRequestException('Cover slot requires a COVER template.');
      }
      layoutMode = null;
    } else if (journalPage.slotType === PageType.BACK_COVER) {
      if (primaryTemplate.pageType !== PageType.BACK_COVER) {
        throw new BadRequestException('Back cover slot requires a BACK_COVER template.');
      }
      layoutMode = null;
    }

    const pageSnapshot = buildJournalPageSnapshot(
      journalPage.slotType,
      layoutMode,
      primaryTemplate,
      rightTemplate,
    );

    await this.prisma.$transaction([
      this.prisma.placeholderValue.deleteMany({ where: { journalPageId } }),
      this.prisma.journalPage.update({
        where: { id: journalPageId },
        data: {
          magazinePageId: dto.magazinePageId,
          rightMagazinePageId:
            layoutMode === JournalSpreadLayout.SPLIT_PAGES
              ? (rightTemplate?.id ?? null)
              : null,
          layoutMode,
          pageSnapshot: pageSnapshot as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.findOne(orderId, userId);
  }

  async cancel(orderId: string, userId: string) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (!([OrderStatus.DRAFT, OrderStatus.SUBMITTED] as OrderStatus[]).includes(order.status)) {
      throw new BadRequestException('This order cannot be cancelled.');
    }

    const cancelled = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
      include: ORDER_INCLUDE,
    });

    return this.withResolvedAssets(cancelled);
  }

  /** Checkout step — stubbed CDEK: a fixed price/eta per delivery method, no real carrier API
   * call. Saves the delivery details onto the order immediately (there's no separate "confirm
   * address" step) so `submit()` can require them to be present. */
  async calculateDelivery(orderId: string, userId: string, dto: CalculateDeliveryDto) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Delivery can only be set for draft orders.');
    }

    // TODO: real CDEK integration (tariff calculation by address/dimensions/weight).
    const { price, etaDays } =
      dto.method === DeliveryMethod.COURIER
        ? { price: 350, etaDays: 5 }
        : { price: 250, etaDays: 4 };

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryMethod: dto.method,
        deliveryCity: dto.city,
        deliveryAddress: dto.address,
        deliveryPostalCode: dto.postalCode,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        deliveryPrice: price,
        deliveryEtaDays: etaDays,
      },
      include: ORDER_INCLUDE,
    });

    return this.withResolvedAssets(updated);
  }

  async applyPromoCode(orderId: string, userId: string, dto: ApplyPromoCodeDto) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Promo codes can only be applied to draft orders.');
    }

    const promoCode = await this.prisma.promoCode.findFirst({
      where: { code: { equals: dto.code.trim(), mode: 'insensitive' } },
    });

    if (!promoCode || !promoCode.isActive) {
      throw new BadRequestException('Промокод не найден.');
    }

    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new BadRequestException('Промокод больше не действует.');
    }

    if (promoCode.usageLimit != null && promoCode.usageCount >= promoCode.usageLimit) {
      throw new BadRequestException('Промокод больше не действует.');
    }

    const itemPrice = Number(order.totalPrice ?? 0);
    const discountAmount = promoCode.discountPercent != null
      ? Math.round((itemPrice * promoCode.discountPercent) / 100)
      : Number(promoCode.discountAmount ?? 0);

    const previousPromoCodeId = order.promoCodeId;

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { promoCodeId: promoCode.id, discountAmount },
        include: ORDER_INCLUDE,
      }),
      this.prisma.promoCode.update({
        where: { id: promoCode.id },
        data: { usageCount: { increment: 1 } },
      }),
      // Switching from one code to another shouldn't leave the old code's usage count inflated.
      ...(previousPromoCodeId && previousPromoCodeId !== promoCode.id
        ? [
            this.prisma.promoCode.update({
              where: { id: previousPromoCodeId },
              data: { usageCount: { decrement: 1 } },
            }),
          ]
        : []),
    ]);

    return this.withResolvedAssets(updated);
  }

  async removePromoCode(orderId: string, userId: string) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Promo codes can only be changed on draft orders.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { promoCodeId: null, discountAmount: null },
        include: ORDER_INCLUDE,
      }),
      ...(order.promoCodeId
        ? [
            this.prisma.promoCode.update({
              where: { id: order.promoCodeId },
              data: { usageCount: { decrement: 1 } },
            }),
          ]
        : []),
    ]);

    return this.withResolvedAssets(updated);
  }

  /** Deletes a draft journal the user no longer wants — deliberately restricted to `DRAFT`:
   * anything past that may already be paid/in production, and has `cancel()` for that instead. */
  async remove(orderId: string, userId: string): Promise<void> {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft journals can be deleted.');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { deletedAt: new Date() },
    });
  }

  async updateDraft(_orderId: string, _userId: string, _data: unknown) {
    throw new BadRequestException('Use placeholder endpoints to update draft orders.');
  }

  async updateStatus(_orderId: string, _status: string, _actorId: string, _metadata?: unknown) {
    throw new BadRequestException('Not implemented');
  }

  private collectMissingRequiredPlaceholders(
    order: OrderWithDetails,
  ): Array<{ journalPageId: string; pageName: string; elementId: string; label: string }> {
    const missing: Array<{
      journalPageId: string;
      pageName: string;
      elementId: string;
      label: string;
    }> = [];

    for (const journalPage of order.journalPages) {
      const canvas = normalizeCanvasData(journalPage.pageSnapshot);
      const valuesByElement = new Map(
        journalPage.placeholderValues.map((value) => [value.elementId, value]),
      );

      for (const element of flattenTree(canvas.elements)) {
        if (!isFillableElement(element)) {
          continue;
        }

        const isRequired =
          element.type === 'photo-placeholder' || 'required' in element
            ? Boolean((element as { required?: boolean }).required)
            : false;

        if (!isRequired) {
          continue;
        }

        const value = valuesByElement.get(element.id);
        if (!isPlaceholderFilled(element, value)) {
          missing.push({
            journalPageId: journalPage.id,
            pageName: journalPage.magazinePage.name,
            elementId: element.id,
            label:
              element.type === 'photo-placeholder'
                ? element.label
                : (element as { label: string }).label,
          });
        }
      }
    }

    return missing;
  }

  private async loadConfiguredSpreads(magazineTypeId: string) {
    const rows = await this.prisma.magazineDefaultSpread.findMany({
      where: { magazineTypeId },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length === 0) {
      return undefined;
    }

    return rows.map((row) => ({
      layoutMode: row.layoutMode,
      magazinePageId: row.magazinePageId,
      rightMagazinePageId: row.rightMagazinePageId,
    }));
  }

  private async getOwnedOrderOrThrow(
    orderId: string,
    userId: string,
    include: typeof ORDER_INCLUDE,
  ): Promise<OrderWithDetails>;
  private async getOwnedOrderOrThrow(
    orderId: string,
    userId: string,
    include?: undefined,
  ): Promise<Prisma.OrderGetPayload<object>>;
  private async getOwnedOrderOrThrow(
    orderId: string,
    userId: string,
    include?: typeof ORDER_INCLUDE,
  ): Promise<OrderWithDetails | Prisma.OrderGetPayload<object>> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order as OrderWithDetails;
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedAssets<T extends Record<string, unknown>>(order: T): T {
    const base = this.backendUrl();

    const magazineType = order.magazineType as
      | { coverImage?: string | null }
      | undefined;

    const journalPages = (order.journalPages as Array<Record<string, unknown>> | undefined)?.map(
      (journalPage) => {
        const magazinePage = journalPage.magazinePage as
          | { previewImage?: string | null }
          | undefined;

        const rightMagazinePage = journalPage.rightMagazinePage as
          | { previewImage?: string | null }
          | undefined
          | null;

        const placeholderValues = (
          journalPage.placeholderValues as Array<Record<string, unknown>>
        )?.map((value) => {
          if (value.valueType !== 'PHOTO' || !value.jsonValue) {
            return value;
          }

          const json = value.jsonValue as { url?: string };
          return {
            ...value,
            jsonValue: {
              ...json,
              url: resolveAssetUrl(json.url, base),
            },
          };
        });

        return {
          ...journalPage,
          magazinePage: magazinePage
            ? {
                ...magazinePage,
                previewImage: resolveAssetUrl(magazinePage.previewImage ?? null, base),
              }
            : magazinePage,
          rightMagazinePage: rightMagazinePage
            ? {
                ...rightMagazinePage,
                previewImage: resolveAssetUrl(rightMagazinePage.previewImage ?? null, base),
              }
            : rightMagazinePage,
          placeholderValues,
        };
      },
    );

    return {
      ...order,
      magazineType: magazineType
        ? {
            ...magazineType,
            coverImage: resolveAssetUrl(magazineType.coverImage ?? null, base),
          }
        : magazineType,
      journalPages,
    } as T;
  }
}
