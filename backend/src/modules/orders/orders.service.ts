import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryMethod,
  JournalSpreadLayout,
  OrderStatus,
  PageType,
  PlaceholderSource,
  PlaceholderValueType,
  Prisma,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl } from '../../common/utils/asset-url.util';
import { MIN_JOURNAL_SPREADS } from '../../shared/constants/journal.constants';
import { normalizeCanvasData } from '../../shared/types/canvas-data.types';
import type { CanvasAiTextPlaceholder, CanvasLeafElement } from '../../shared/types/canvas-data.types';
import { findAiTextLeavesForKeys, flattenTree } from '../../shared/utils/element-tree.util';
import { AiTextGenerationService } from '../ai-text-generation/ai-text-generation.service';
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
import type {
  QuestionAnswerInputDto,
  UpsertQuestionnaireAnswersDto,
} from './dto/upsert-questionnaire-answers.dto';

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
  questionAnswers: true,
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly aiTextGeneration: AiTextGenerationService,
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
        // A direct write through this endpoint is always a deliberate user edit (simple editor) —
        // distinct from a value derived by syncAnswersToPlaceholders from a questionnaire answer.
        // Marking it OVERRIDDEN stops that sync from silently clobbering it on the next answer save.
        source: PlaceholderSource.OVERRIDDEN,
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
   * Saves questionnaire answers at the order level (one row per `(orderId, questionKey)` — a
   * single answer can be bound to elements on several `JournalPage`s at once, unlike
   * `PlaceholderValue` which is keyed per page/element) and projects the changed answers into
   * every matching canvas element via `syncAnswersToPlaceholders`.
   */
  async upsertQuestionnaireAnswers(
    orderId: string,
    userId: string,
    dto: UpsertQuestionnaireAnswersDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(orderId, userId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be edited.');
    }

    const keys = dto.answers.map((input) => input.questionKey);

    const [questions, existingAnswers] = await Promise.all([
      this.prisma.question.findMany({
        where: { magazineTypeId: order.magazineTypeId, key: { in: keys }, deletedAt: null },
        include: { options: true },
      }),
      this.prisma.questionAnswer.findMany({
        where: { orderId, questionKey: { in: keys } },
      }),
    ]);
    const questionByKey = new Map(questions.map((question) => [question.key, question]));
    const existingByKey = new Map(existingAnswers.map((answer) => [answer.questionKey, answer]));

    const changedKeys = new Set<string>();

    for (const input of dto.answers) {
      const question = questionByKey.get(input.questionKey);

      if (!question) {
        throw new BadRequestException(`Question "${input.questionKey}" not found.`);
      }

      const { isEmpty, textValue, jsonValue } = this.resolveQuestionAnswerInput(question, input);
      const existing = existingByKey.get(input.questionKey);

      if (isEmpty) {
        if (existing) {
          await this.prisma.questionAnswer.delete({ where: { id: existing.id } });
          changedKeys.add(input.questionKey);
        }
        continue;
      }

      await this.prisma.questionAnswer.upsert({
        where: { orderId_questionKey: { orderId, questionKey: input.questionKey } },
        create: { orderId, questionKey: input.questionKey, textValue, jsonValue: jsonValue ?? Prisma.JsonNull },
        update: { textValue, jsonValue: jsonValue ?? Prisma.JsonNull },
      });
      changedKeys.add(input.questionKey);
    }

    if (changedKeys.size > 0) {
      await this.syncAnswersToPlaceholders(orderId, { questionKeys: [...changedKeys] });
      await this.generateAiTextForElements(orderId, { questionKeys: [...changedKeys] });
    }

    return this.findOne(orderId, userId);
  }

  /** Validates one answer input against its `Question.type` and normalizes it into the shape
   * `QuestionAnswer` stores: TEXT/TEXTAREA/DATE/SELECT → `textValue`, IMAGE → `{ url }`,
   * GALLERY → `{ urls }`. SELECT is additionally checked against the question's own options. */
  private resolveQuestionAnswerInput(
    question: Prisma.QuestionGetPayload<{ include: { options: true } }>,
    input: QuestionAnswerInputDto,
  ): { isEmpty: boolean; textValue: string | null; jsonValue: Prisma.InputJsonValue | null } {
    switch (question.type) {
      case QuestionType.TEXT:
      case QuestionType.TEXTAREA:
      case QuestionType.DATE: {
        const value = input.textValue?.trim() || null;
        return { isEmpty: !value, textValue: value, jsonValue: null };
      }

      case QuestionType.SELECT: {
        const value = input.textValue?.trim() || null;

        if (value && !question.options.some((option) => option.value === value)) {
          throw new BadRequestException(`Invalid option for question "${question.key}".`);
        }

        return { isEmpty: !value, textValue: value, jsonValue: null };
      }

      case QuestionType.IMAGE: {
        const url = typeof input.jsonValue?.url === 'string' ? input.jsonValue.url.trim() : '';
        return {
          isEmpty: !url,
          textValue: null,
          jsonValue: url ? ({ url } as Prisma.InputJsonValue) : null,
        };
      }

      case QuestionType.GALLERY: {
        const rawUrls = input.jsonValue?.urls;
        const urls = Array.isArray(rawUrls)
          ? rawUrls.filter(
              (url): url is string => typeof url === 'string' && url.trim().length > 0,
            )
          : [];
        return {
          isEmpty: urls.length === 0,
          textValue: null,
          jsonValue: urls.length > 0 ? ({ urls } as Prisma.InputJsonValue) : null,
        };
      }
    }
  }

  /** `text-placeholder`/`title-placeholder`/`subtitle-placeholder`/`photo-placeholder` are the
   * only leaf types a QuestionAnswer ever writes into — `ai-text-placeholder` reads `questionKeys`
   * but is deliberately never written here (excluded from `isFillableElement` too): its content
   * comes from AI generation, a later phase, not a direct answer projection. */
  private matchesQuestionKey(leaf: CanvasLeafElement, key: string): boolean {
    if (
      leaf.type === 'text-placeholder' ||
      leaf.type === 'title-placeholder' ||
      leaf.type === 'subtitle-placeholder' ||
      leaf.type === 'photo-placeholder'
    ) {
      return leaf.questionKey === key;
    }

    return false;
  }

  /**
   * Projects `QuestionAnswer` rows into every matching canvas element's `PlaceholderValue`,
   * scoped by `questionKeys` (incremental — called after an answer changes) and/or
   * `journalPageIds` (called after a page's template is swapped and its snapshot regenerated).
   * With neither filter, re-applies every answer of the order across every page. Never touches a
   * `PlaceholderValue` whose `source` is already `OVERRIDDEN`.
   */
  private async syncAnswersToPlaceholders(
    orderId: string,
    options: { questionKeys?: string[]; journalPageIds?: string[] },
  ): Promise<void> {
    const [answers, journalPages] = await Promise.all([
      this.prisma.questionAnswer.findMany({
        where: {
          orderId,
          ...(options.questionKeys && { questionKey: { in: options.questionKeys } }),
        },
      }),
      this.prisma.journalPage.findMany({
        where: {
          orderId,
          ...(options.journalPageIds && { id: { in: options.journalPageIds } }),
        },
        orderBy: { sortOrder: 'asc' },
        include: { placeholderValues: true },
      }),
    ]);

    if (journalPages.length === 0) {
      return;
    }

    const answerByKey = new Map(answers.map((answer) => [answer.questionKey, answer]));
    // Keys to process: explicit list when given (may include a key whose answer was just
    // deleted, which must still clear its previously-synced elements), otherwise every answer.
    const keysToProcess = options.questionKeys ?? [...answerByKey.keys()];

    if (keysToProcess.length === 0) {
      return;
    }

    const pagesWithLeaves = journalPages.map((page) => ({
      page,
      leaves: flattenTree(normalizeCanvasData(page.pageSnapshot).elements),
    }));

    const writes: Prisma.PrismaPromise<unknown>[] = [];

    for (const key of keysToProcess) {
      const answer = answerByKey.get(key) ?? null;

      const matches: Array<{ journalPageId: string; element: CanvasLeafElement }> = [];
      for (const { page, leaves } of pagesWithLeaves) {
        for (const leaf of leaves) {
          if (this.matchesQuestionKey(leaf, key)) {
            matches.push({ journalPageId: page.id, element: leaf });
          }
        }
      }

      if (matches.length === 0) {
        continue;
      }

      const galleryUrls = Array.isArray((answer?.jsonValue as { urls?: unknown } | null)?.urls)
        ? ((answer!.jsonValue as { urls: string[] }).urls)
        : null;

      matches.forEach(({ journalPageId, element }, index) => {
        const journalPage = journalPages.find((page) => page.id === journalPageId)!;
        const existing = journalPage.placeholderValues.find(
          (value) => value.elementId === element.id,
        );

        if (existing?.source === PlaceholderSource.OVERRIDDEN) {
          return;
        }

        if (element.type === 'photo-placeholder') {
          const url = galleryUrls
            ? galleryUrls[index]
            : (answer?.jsonValue as { url?: string } | null)?.url;
          const trimmedUrl = typeof url === 'string' ? url.trim() : '';

          if (!trimmedUrl) {
            if (existing) {
              writes.push(this.prisma.placeholderValue.delete({ where: { id: existing.id } }));
            }
            return;
          }

          const mergedJson = {
            ...((existing?.jsonValue as Record<string, unknown> | null) ?? {}),
            url: trimmedUrl,
          } as Prisma.InputJsonValue;

          writes.push(
            existing
              ? this.prisma.placeholderValue.update({
                  where: { id: existing.id },
                  data: {
                    jsonValue: mergedJson,
                    valueType: PlaceholderValueType.PHOTO,
                    source: PlaceholderSource.AUTO,
                  },
                })
              : this.prisma.placeholderValue.create({
                  data: {
                    journalPageId,
                    elementId: element.id,
                    valueType: PlaceholderValueType.PHOTO,
                    jsonValue: mergedJson,
                    source: PlaceholderSource.AUTO,
                  },
                }),
          );
          return;
        }

        const textValue = answer?.textValue?.trim();

        if (!textValue) {
          if (existing) {
            writes.push(this.prisma.placeholderValue.delete({ where: { id: existing.id } }));
          }
          return;
        }

        const valueType = resolvePlaceholderValueType(element);

        writes.push(
          existing
            ? this.prisma.placeholderValue.update({
                where: { id: existing.id },
                data: { textValue, valueType, source: PlaceholderSource.AUTO },
              })
            : this.prisma.placeholderValue.create({
                data: {
                  journalPageId,
                  elementId: element.id,
                  textValue,
                  valueType,
                  source: PlaceholderSource.AUTO,
                },
              }),
        );
      });
    }

    if (writes.length > 0) {
      await this.prisma.$transaction(writes);
    }
  }

  /**
   * Generates text for `ai-text-placeholder` elements whose `questionKeys` intersect the given
   * answers, via YandexGPT (see `AiTextGenerationService`) — mirrors `syncAnswersToPlaceholders`'s
   * shape (same two call sites, same `questionKeys`/`journalPageIds` filters), but writes
   * `source: AI` instead of `AUTO` and is best-effort: any failure (missing config, upstream
   * error) is logged and swallowed here so it can never fail the answer-save request it's called
   * from.
   */
  private async generateAiTextForElements(
    orderId: string,
    options: { questionKeys?: string[]; journalPageIds?: string[] },
  ): Promise<void> {
    try {
      const journalPages = await this.prisma.journalPage.findMany({
        where: {
          orderId,
          ...(options.journalPageIds && { id: { in: options.journalPageIds } }),
        },
        orderBy: { sortOrder: 'asc' },
        include: { placeholderValues: true },
      });

      if (journalPages.length === 0) {
        return;
      }

      const pagesWithLeaves = journalPages.map((page) => ({
        page,
        leaves: flattenTree(normalizeCanvasData(page.pageSnapshot).elements),
      }));

      const allAnswers = await this.prisma.questionAnswer.findMany({ where: { orderId } });
      // Same "answered" criterion buildAiPromptContext uses (non-empty textValue) — gates
      // generation below on every one of an element's questionKeys meeting it, not just one.
      const answeredKeys = new Set(
        allAnswers.filter((answer) => answer.textValue?.trim()).map((answer) => answer.questionKey),
      );

      // questionKeys not given (called from setJournalPageTemplate) → the new page's AI-text
      // elements could reference any question the order has ever answered, not just recently
      // changed ones, so consider every key with a non-empty answer.
      const relevantKeys = options.questionKeys
        ? new Set(options.questionKeys)
        : new Set(allAnswers.map((answer) => answer.questionKey));

      if (relevantKeys.size === 0) {
        return;
      }

      const matches: Array<{ journalPageId: string; element: ReturnType<typeof findAiTextLeavesForKeys>[number] }> = [];
      for (const { page, leaves } of pagesWithLeaves) {
        for (const element of findAiTextLeavesForKeys(leaves, relevantKeys)) {
          matches.push({ journalPageId: page.id, element });
        }
      }

      if (matches.length === 0) {
        return;
      }

      for (const { journalPageId, element } of matches) {
        const journalPage = journalPages.find((page) => page.id === journalPageId)!;
        const existing = journalPage.placeholderValues.find((value) => value.elementId === element.id);

        if (existing?.source === PlaceholderSource.OVERRIDDEN) {
          continue;
        }

        // Wait for every one of this element's feeding questions, not just whichever one(s) just
        // changed — generating from a partial answer set (e.g. 1 of 2 questions) would need
        // regenerating anyway once the rest come in, and risks YandexGPT inventing content for the
        // still-missing ones.
        if (!element.questionKeys.every((key) => answeredKeys.has(key))) {
          continue;
        }

        const promptContext = await this.buildAiPromptContext(orderId, element);
        if (!promptContext) {
          continue;
        }

        const text = await this.aiTextGeneration.generateText(promptContext, element.lengthConstraint);

        if (!text) {
          continue;
        }

        const data = { textValue: text, valueType: PlaceholderValueType.TEXT, source: PlaceholderSource.AI };

        if (existing) {
          await this.prisma.placeholderValue.update({ where: { id: existing.id }, data });
        } else {
          await this.prisma.placeholderValue.create({
            data: { journalPageId, elementId: element.id, ...data },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`AI text generation failed for order ${orderId}: ${err}`);
    }
  }

  /** Builds the assembled instruction (admin `prompt` + question/answer pairs) sent to YandexGPT
   * for one `ai-text-placeholder` element — `null` when none of its `questionKeys` have a
   * non-empty answer yet (nothing to generate from). Shared by the best-effort batch sync above
   * and the user-facing single-element `regenerateAiText` below. */
  private async buildAiPromptContext(
    orderId: string,
    element: CanvasAiTextPlaceholder,
  ): Promise<string | null> {
    const [questions, answers] = await Promise.all([
      this.prisma.question.findMany({ where: { key: { in: element.questionKeys } } }),
      this.prisma.questionAnswer.findMany({
        where: { orderId, questionKey: { in: element.questionKeys } },
      }),
    ]);
    const questionByKey = new Map(questions.map((question) => [question.key, question]));
    const answerByKey = new Map(answers.map((answer) => [answer.questionKey, answer]));

    const pairs = element.questionKeys
      .map((key) => {
        const question = questionByKey.get(key);
        const answerText = answerByKey.get(key)?.textValue?.trim();
        return question && answerText ? `${question.label}: ${answerText}` : null;
      })
      .filter((line): line is string => Boolean(line));

    if (pairs.length === 0) {
      return null;
    }

    return `${element.prompt}\n\nОтветы пользователя:\n${pairs.join('\n')}`;
  }

  /**
   * User-initiated regeneration of a single `ai-text-placeholder` element (the "Перегенерировать"
   * button in the customer editor) — unlike `generateAiTextForElements`, this is NOT best-effort:
   * it's a deliberate action, so failures (no answers yet, YandexGPT not configured/unavailable)
   * are surfaced to the caller instead of being logged and swallowed.
   */
  async regenerateAiText(
    orderId: string,
    userId: string,
    journalPageId: string,
    elementId: string,
  ): Promise<{ text: string }> {
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

    const leaves = flattenTree(normalizeCanvasData(journalPage.pageSnapshot).elements);
    const element = leaves.find((leaf) => leaf.id === elementId);

    if (!element || element.type !== 'ai-text-placeholder') {
      throw new BadRequestException(`Element "${elementId}" is not an AI-text placeholder.`);
    }

    const promptContext = await this.buildAiPromptContext(orderId, element);
    if (!promptContext) {
      throw new BadRequestException('Ни на один из связанных вопросов ещё нет ответа.');
    }

    const text = await this.aiTextGeneration.generateText(promptContext, element.lengthConstraint);
    if (!text) {
      throw new ServiceUnavailableException(
        'Не удалось сгенерировать текст. Попробуйте ещё раз позже.',
      );
    }

    const existing = await this.prisma.placeholderValue.findUnique({
      where: { journalPageId_elementId: { journalPageId, elementId } },
    });
    const data = { textValue: text, valueType: PlaceholderValueType.TEXT, source: PlaceholderSource.AI };

    if (existing) {
      await this.prisma.placeholderValue.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.placeholderValue.create({ data: { journalPageId, elementId, ...data } });
    }

    return { text };
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

    // The new template's elements are fresh (different elementIds, possibly different
    // questionKey bindings) — re-apply every existing questionnaire answer for the order into
    // this one regenerated page, so already-answered questions repopulate immediately instead of
    // staying blank until the next unrelated answer edit.
    await this.syncAnswersToPlaceholders(orderId, { journalPageIds: [journalPageId] });
    await this.generateAiTextForElements(orderId, { journalPageIds: [journalPageId] });

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

    // Real values come from the CDEK widget's onCalculate/onChoose callback (CheckoutPage.vue) —
    // fall back to a flat stub only when they're absent (widget not configured yet, or a direct
    // API call bypassing it).
    const price = dto.price ?? (dto.method === DeliveryMethod.COURIER ? 350 : 250);
    const etaDays = dto.etaDays ?? (dto.method === DeliveryMethod.COURIER ? 5 : 4);

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

    const questionAnswers = (
      order.questionAnswers as Array<Record<string, unknown>> | undefined
    )?.map((answer) => {
      if (!answer.jsonValue) {
        return answer;
      }

      const json = answer.jsonValue as { url?: string; urls?: string[] };

      if (typeof json.url === 'string') {
        return { ...answer, jsonValue: { ...json, url: resolveAssetUrl(json.url, base) } };
      }

      if (Array.isArray(json.urls)) {
        return {
          ...answer,
          jsonValue: { ...json, urls: json.urls.map((url) => resolveAssetUrl(url, base)) },
        };
      }

      return answer;
    });

    return {
      ...order,
      magazineType: magazineType
        ? {
            ...magazineType,
            coverImage: resolveAssetUrl(magazineType.coverImage ?? null, base),
          }
        : magazineType,
      journalPages,
      ...(questionAnswers && { questionAnswers }),
    } as T;
  }
}
