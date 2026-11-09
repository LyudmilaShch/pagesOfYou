import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { catalogApi, type CatalogMagazinePage } from '../api/catalog.api'
import {
  ordersApi,
  type CreateOrderJournalPagePayload,
  type SetJournalPageTemplatePayload,
} from '../api/orders.api'
import { photoGalleryApi } from '../api/photo-gallery.api'
import {
  aiTextsApi,
  type AiUsageStatus,
  type DraftAiTextPurpose,
  type GenerateDraftAiTextPayload,
} from '../api/ai-texts.api'
import {
  aiTextGroupsOf,
  answerMapOf,
  collectDraftJournalTexts,
  draftAnswersPayload,
  draftPagePayload,
  questionAiTextStatuses,
  textOf,
} from '../utils/draft-ai-texts.util'
import { aiAnswersSignature } from '../utils/ai-answers-signature.util'
import { isAxiosError } from 'axios'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import { getOrCreateGuestId } from '@/shared/utils/guest-id.util'
import {
  claimedGalleryCovers,
  createGuestGalleryId,
  galleryIdForRestoredDraft,
  retryAsync,
} from '../utils/guest-gallery.util'
import {
  LocalDraftStorageError,
  markLocalDraftAdopted,
  readLocalDraft,
  readLocalDrafts,
  removeLocalDraft,
  saveLocalDraft,
  type StoredLocalDraft,
} from '../utils/local-draft-storage.util'
import { stripPhotoUrlFromJournalPages } from '../utils/strip-photo-url.util'
import { calculateJournalPrice } from '../utils/pricing.util'
import { useAuthStore } from '@/stores/auth.store'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { MIN_JOURNAL_SPREADS } from '../constants/journal.constants'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import { isAiTextElement } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import type { MagazineType } from '../types/magazine-type'
import type {
  JournalPage,
  OrderDetail,
  PlaceholderInput,
  QuestionAnswerInput,
  TrashedJournalPage,
} from '../types/order.types'
import {
  buildInitialJournalSlots,
  buildJournalPageSnapshot,
  countSpreadSlots,
  findTemplateById,
  getJournalPageDisplayName,
  groupTemplatesByPageType,
  pickDefaultSpreadTemplate,
  toMagazinePageSummary,
  type DefaultSpreadTemplate,
} from '../utils/journal-structure.util'
import {
  isFillableElement,
  isPlaceholderFilled,
} from '../utils/placeholder.utils'

export const useOrderBuilderStore = defineStore('orderBuilder', () => {
  const magazineTypes = ref<MagazineType[]>([])
  const isLoadingTypes = ref(false)
  const loadError = ref<string | null>(null)

  const selectedMagazineType = ref<MagazineType | null>(null)
  const templateCatalog = ref<CatalogMagazinePage[]>([])
  const configuredDefaultSpreads = ref<DefaultSpreadTemplate[]>([])

  const order = ref<OrderDetail | null>(null)
  const isLocalDraft = ref(false)
  const isLoadingOrder = ref(false)
  const isSaving = ref(false)
  const isSubmitting = ref(false)
  const orderError = ref<string | null>(null)
  // SpreadManagerDialog.vue's recycle bin for a local-draft journal — mirrors the real order's
  // server-side trash (`deletedAt` on JournalPage) but has to live here instead, since a local
  // draft has no backend row yet. Only ever populated/read while `isLocalDraft` is true.
  const trashedJournalPages = ref<TrashedJournalPage[]>([])
  // Photo-gallery token for the guest journal currently in memory. A new journal mints a new one
  // (`loadLocalDraft`); resuming a draft reuses the token saved with it (`restoreLocalDraft`).
  // Null when there is no guest journal — signed-in orders are scoped by order id instead.
  const guestGalleryId = ref<string | null>(null)
  let storageErrorShown = false

  function persistLocalDraft(): boolean {
    if (!order.value || !isLocalDraft.value) {
      return true
    }

    try {
      saveLocalDraft(
        order.value.magazineTypeId,
        order.value,
        trashedJournalPages.value,
        guestGalleryId.value,
      )
      storageErrorShown = false
      const galleryId = guestGalleryId.value
      if (galleryId) {
        // Keeps this journal's server photos inside the same 14-day window as the draft.
        // A failed touch must not block editing; the purge uses createdAt when touch never landed.
        void photoGalleryApi.touchGuestGallery(galleryId).catch(() => undefined)
      }
      return true
    } catch (err) {
      if (!(err instanceof LocalDraftStorageError)) {
        throw err
      }
      orderError.value =
        'Не удалось сохранить черновик. Хранилище браузера недоступно или переполнено.'
      if (!storageErrorShown) {
        storageErrorShown = true
        useErrorMessageModal().showErrorMessageModal(orderError.value, 'Черновик не сохранён')
      }
      return false
    }
  }

  const groupedTemplates = computed(() => groupTemplatesByPageType(templateCatalog.value))

  async function fetchMagazineTypes(): Promise<void> {
    if (magazineTypes.value.length > 0) {
      return
    }

    isLoadingTypes.value = true
    loadError.value = null

    try {
      magazineTypes.value = await catalogApi.getMagazineTypes()
    } catch {
      loadError.value = 'Не удалось загрузить список журналов. Попробуйте ещё раз.'
    } finally {
      isLoadingTypes.value = false
    }
  }

  function selectMagazineType(type: MagazineType): void {
    selectedMagazineType.value = type
    orderError.value = null
  }

  function clearSelection(): void {
    selectedMagazineType.value = null
  }

  function buildLocalJournalPages(
    templates: CatalogMagazinePage[],
    magazineTypeId: string,
    includedSpreads: number,
    configuredSpreads?: DefaultSpreadTemplate[],
  ): JournalPage[] {
    const catalog = groupTemplatesByPageType(templates)

    if (catalog.cover.length === 0) {
      throw new Error('MISSING_COVER_TEMPLATES')
    }

    const slots = buildInitialJournalSlots(templates, { includedSpreads, configuredSpreads })

    return slots.map((slot) => {
      const primary = findTemplateById(templates, slot.magazinePageId)!
      const right = slot.rightMagazinePageId
        ? findTemplateById(templates, slot.rightMagazinePageId)
        : null

      return {
        id: `local-${magazineTypeId}-${slot.slotType}-${slot.sortOrder}`,
        sortOrder: slot.sortOrder,
        slotType: slot.slotType,
        layoutMode: slot.layoutMode,
        pageSnapshot: slot.pageSnapshot,
        magazinePage: toMagazinePageSummary(primary),
        rightMagazinePage: right ? toMagazinePageSummary(right) : null,
        placeholderValues: [],
      }
    })
  }

  /** Shared by `loadLocalDraft` (fresh journal) and `restoreLocalDraft` (resuming a stored guest
   * draft) — fetches this magazine type's templates/default spreads and populates
   * `templateCatalog`/`configuredDefaultSpreads`, which both need regardless of where the journal
   * pages themselves come from. */
  async function loadTemplatesForMagazineType(
    magazineTypeId: string,
  ): Promise<{ magazineType: MagazineType; pages: CatalogMagazinePage[] }> {
    if (magazineTypes.value.length === 0) {
      await fetchMagazineTypes()
    }

    const magazineType =
      magazineTypes.value.find((type) => type.id === magazineTypeId) ??
      selectedMagazineType.value

    if (!magazineType || magazineType.id !== magazineTypeId) {
      orderError.value = 'Тип журнала не найден.'
      throw new Error(orderError.value)
    }

    const pages = await catalogApi.getMagazinePages(magazineTypeId)
    templateCatalog.value = pages

    const defaultSpreads = await catalogApi.getDefaultSpreads(magazineTypeId)
    configuredDefaultSpreads.value = defaultSpreads.map((spread) => ({
      layoutMode: spread.layoutMode as DefaultSpreadTemplate['layoutMode'],
      magazinePageId: spread.magazinePageId,
      rightMagazinePageId: spread.rightMagazinePageId,
    }))

    if (pages.length === 0) {
      orderError.value = 'У этого журнала пока нет шаблонов страниц.'
      throw new Error(orderError.value)
    }

    return { magazineType, pages }
  }

  async function loadLocalDraft(magazineTypeId: string): Promise<void> {
    isLoadingOrder.value = true
    orderError.value = null
    isLocalDraft.value = true
    // Always a new gallery: this builds a journal from scratch and overwrites the single guest
    // draft slot. Reusing the previous token is what made the last journal's photos reappear.
    guestGalleryId.value = createGuestGalleryId()

    try {
      const { magazineType, pages } = await loadTemplatesForMagazineType(magazineTypeId)

      const catalog = groupTemplatesByPageType(pages)
      if (catalog.cover.length === 0) {
        orderError.value = 'Для журнала нужен шаблон обложки.'
        throw new Error(orderError.value)
      }

      selectedMagazineType.value = magazineType

      const journalPages = buildLocalJournalPages(
        pages,
        magazineTypeId,
        magazineType.includedSpreads,
        configuredDefaultSpreads.value.length > 0
          ? configuredDefaultSpreads.value
          : undefined,
      )
      const totalPrice = calculateJournalPrice(magazineType, countSpreadSlots(journalPages))

      order.value = {
        id: `local-${crypto.randomUUID()}`,
        status: 'DRAFT',
        magazineTypeId,
        totalPrice: String(totalPrice),
        magazineType: {
          id: magazineType.id,
          name: magazineType.name,
          slug: '',
          coverImage: magazineType.image || null,
          basePrice: magazineType.basePrice != null ? String(magazineType.basePrice) : null,
          oldPrice: magazineType.oldPrice != null ? String(magazineType.oldPrice) : null,
          includedSpreads: magazineType.includedSpreads,
          pricePerExtraFourPages:
            magazineType.pricePerExtraFourPages != null ? String(magazineType.pricePerExtraFourPages) : null,
        },
        journalPages,
        // A guest's local draft can't have answers yet — the questionnaire only ever saves
        // against a real backend order (converted from this draft on login).
        questionAnswers: [],
        // Delivery/promo only ever get set on a real backend order, from the checkout page —
        // a local draft never reaches checkout directly (it's converted to a real order first).
        deliveryMethod: null,
        deliveryCity: null,
        deliveryAddress: null,
        deliveryPostalCode: null,
        recipientName: null,
        recipientPhone: null,
        deliveryPrice: null,
        deliveryEtaDays: null,
        promoCode: null,
        discountAmount: null,
      }
      trashedJournalPages.value = []

      persistLocalDraft()
    } catch (err: unknown) {
      if (!orderError.value) {
        orderError.value =
          err instanceof Error && err.message === 'MISSING_COVER_TEMPLATES'
            ? 'Для журнала нужен шаблон обложки.'
            : 'Не удалось загрузить страницы журнала.'
      }
      throw new Error(orderError.value)
    } finally {
      isLoadingOrder.value = false
    }
  }

  /** Resumes a guest's journal from its localStorage snapshot (see `local-draft-storage.util.ts`)
   * — re-fetches templates live (they're derivable and could go stale) but reuses the stored
   * `journalPages` as-is, exactly as the guest left them. */
  async function restoreLocalDraft(stored: StoredLocalDraft): Promise<void> {
    isLoadingOrder.value = true
    orderError.value = null
    isLocalDraft.value = true

    try {
      const { magazineType } = await loadTemplatesForMagazineType(stored.magazineTypeId)
      selectedMagazineType.value = magazineType
      order.value = stored.order
      trashedJournalPages.value = stored.trash ?? []
      guestGalleryId.value = galleryIdForRestoredDraft(stored.galleryGuestId, getOrCreateGuestId())
      // Stamp the token onto older drafts (saved before per-journal galleries) so the next save
      // doesn't drop the association that their existing uploads still depend on.
      persistLocalDraft()
    } catch {
      if (!orderError.value) {
        orderError.value = 'Не удалось восстановить черновик.'
      }
      throw new Error(orderError.value)
    } finally {
      isLoadingOrder.value = false
    }
  }

  /** Entry point for "Продолжить" on the magazine-type picker — an authenticated user gets a real
   * backend draft order immediately (so it's never lost and autosaves like any other order, see
   * `JournalPageEditorPage.vue`'s `saveDocument`); a guest keeps today's in-memory local draft,
   * mirrored to localStorage as they edit (see `loadLocalDraft`/local-mutation functions below). */
  async function startDraft(magazineTypeId: string): Promise<void> {
    if (useAuthStore().isAuthenticated) {
      await createDraftOrder(magazineTypeId)
    } else {
      await loadLocalDraft(magazineTypeId)
    }
  }

  async function createDraftOrder(magazineTypeId: string): Promise<OrderDetail> {
    isLoadingOrder.value = true
    orderError.value = null
    isLocalDraft.value = false

    try {
      const pages = await catalogApi.getMagazinePages(magazineTypeId)
      templateCatalog.value = pages
      const defaultSpreads = await catalogApi.getDefaultSpreads(magazineTypeId)
      configuredDefaultSpreads.value = defaultSpreads.map((spread) => ({
        layoutMode: spread.layoutMode as DefaultSpreadTemplate['layoutMode'],
        magazinePageId: spread.magazinePageId,
        rightMagazinePageId: spread.rightMagazinePageId,
      }))
      order.value = await ordersApi.createDraft(magazineTypeId)
      return order.value
    } catch {
      orderError.value = 'Не удалось создать заказ. Попробуйте ещё раз.'
      throw new Error(orderError.value)
    } finally {
      isLoadingOrder.value = false
    }
  }

  async function loadOrder(orderId: string): Promise<void> {
    isLoadingOrder.value = true
    orderError.value = null
    isLocalDraft.value = false

    try {
      order.value = await ordersApi.getOne(orderId)
      if (order.value) {
        const pages = await catalogApi.getMagazinePages(order.value.magazineTypeId)
        templateCatalog.value = pages
      }
    } catch {
      orderError.value = 'Не удалось загрузить заказ.'
      throw new Error(orderError.value)
    } finally {
      isLoadingOrder.value = false
    }
  }

  /** Keeps this store's in-memory copy of a page's document current after the advanced per-element
   * editor saves it — for a real order this runs alongside the backend save (see
   * `JournalPageEditorPage.vue`), for a local draft it *is* the save. Mirrors the backend's
   * `saveJournalPageCanvas`: replaces the page's document wholesale and clears any placeholder
   * diffs, since they're now baked into the snapshot. */
  function applyJournalPageCanvasEdit(journalPageId: string, canvasData: CanvasData): void {
    if (!order.value) {
      return
    }

    const pageIndex = order.value.journalPages.findIndex((page) => page.id === journalPageId)
    if (pageIndex === -1) {
      return
    }

    order.value.journalPages[pageIndex] = {
      ...order.value.journalPages[pageIndex],
      pageSnapshot: canvasData,
      placeholderValues: [],
    }

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  function applyLocalJournalPageTemplate(
    journalPageId: string,
    payload: SetJournalPageTemplatePayload,
  ): void {
    if (!order.value) {
      return
    }

    const pageIndex = order.value.journalPages.findIndex((page) => page.id === journalPageId)
    if (pageIndex === -1) {
      return
    }

    const page = order.value.journalPages[pageIndex]
    const primary = findTemplateById(templateCatalog.value, payload.magazinePageId)
    if (!primary) {
      return
    }

    const layoutMode =
      page.slotType === 'SPREAD'
        ? (payload.layoutMode ?? page.layoutMode ?? 'SPREAD')
        : null

    const right =
      layoutMode === 'SPLIT_PAGES' && payload.rightMagazinePageId
        ? findTemplateById(templateCatalog.value, payload.rightMagazinePageId)
        : null

    order.value.journalPages[pageIndex] = {
      ...page,
      layoutMode,
      magazinePage: toMagazinePageSummary(primary),
      rightMagazinePage: right ? toMagazinePageSummary(right) : null,
      pageSnapshot: buildJournalPageSnapshot(
        page.slotType,
        layoutMode,
        primary,
        right ?? null,
      ),
      placeholderValues: [],
    }

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  async function setJournalPageTemplate(
    journalPageId: string,
    payload: SetJournalPageTemplatePayload,
  ): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalJournalPageTemplate(journalPageId, payload)
        // Same as the backend's template swap: the fresh page's texts are written from every
        // answer the guest already gave, not left on their placeholder until the next edit. Not
        // awaited — the template switch itself shouldn't wait seconds on YandexGPT.
        void generateLocalAiTextsForAnswers(
          new Set(order.value.questionAnswers.map((answer) => answer.questionKey)),
          journalPageId,
        )
        return
      }

      order.value = await ordersApi.setJournalPageTemplate(
        order.value.id,
        journalPageId,
        payload,
      )
    } catch {
      orderError.value = 'Не удалось применить шаблон.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  /** Mirrors the backend's own upsert/clear semantics (Question saved-answer store) so a guest's
   * local draft behaves identically to a real order once converted. */
  function applyLocalQuestionAnswers(answers: QuestionAnswerInput[]): void {
    if (!order.value) {
      return
    }

    const byKey = new Map(order.value.questionAnswers.map((answer) => [answer.questionKey, answer]))

    for (const input of answers) {
      const isEmpty = !input.textValue?.trim() && !input.jsonValue
      if (isEmpty) {
        byKey.delete(input.questionKey)
      } else {
        byKey.set(input.questionKey, {
          questionKey: input.questionKey,
          textValue: input.textValue?.trim() || null,
          jsonValue: input.jsonValue ?? null,
        })
      }
    }

    order.value.questionAnswers = [...byKey.values()]
    persistLocalDraft()
  }

  async function saveQuestionnaireAnswers(answers: QuestionAnswerInput[]): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      // No AI generation here — this is the questionnaire's autosave while typing; texts are
      // written once a step is left (see generateAiTextsForAnswers).
      if (isLocalDraft.value) {
        applyLocalQuestionAnswers(answers)
        return
      }

      order.value = await ordersApi.saveQuestionnaireAnswers(order.value.id, answers)
    } catch {
      orderError.value = 'Не удалось сохранить ответ.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  /** Mirrors the backend's own upsertPlaceholders semantics (see OrdersService) — a direct write
   * is always treated as a deliberate placement, distinct from one `syncAnswersToPlaceholders`
   * derives from a questionnaire answer, so it's marked OVERRIDDEN to stop a later answer save
   * from silently clobbering it. The `id` is only ever read back locally (never sent anywhere), so
   * a client-side placeholder is fine here — it becomes a real one once this draft converts to an
   * order and every placeholder gets re-synced server-side. */
  function applyLocalPlaceholders(journalPageId: string, values: PlaceholderInput[]): void {
    if (!order.value) {
      return
    }

    const pageIndex = order.value.journalPages.findIndex((page) => page.id === journalPageId)
    if (pageIndex === -1) {
      return
    }

    const page = order.value.journalPages[pageIndex]
    const byElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))

    for (const input of values) {
      byElementId.set(input.elementId, {
        id: byElementId.get(input.elementId)?.id ?? `local-placeholder-${Date.now()}-${input.elementId}`,
        elementId: input.elementId,
        valueType: input.valueType,
        textValue: input.textValue?.trim() || null,
        jsonValue: input.jsonValue ?? null,
        source: 'OVERRIDDEN',
      })
    }

    order.value.journalPages[pageIndex] = {
      ...page,
      placeholderValues: [...byElementId.values()],
    }

    persistLocalDraft()
  }

  /** Direct placeholder write — the advanced editor's simple-fill mode, and now also the photo
   * step's auto-placement (see PhotoUploadPage.vue), both go through this rather than a
   * questionnaire answer. */
  async function savePlaceholders(journalPageId: string, values: PlaceholderInput[]): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalPlaceholders(journalPageId, values)
        return
      }

      order.value = await ordersApi.savePlaceholders(order.value.id, journalPageId, values)
    } catch {
      orderError.value = 'Не удалось сохранить фото.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // AI generation limit + generation for a guest's local draft
  // ---------------------------------------------------------------------------

  /** Today's AI generation allowance (see AiUsageService on the backend) — shown next to the
   * "regenerate" buttons. `null` until first fetched. */
  const aiUsage = ref<AiUsageStatus | null>(null)

  /** The hidden cap on first texts is reached — new blocks stay unwritten until tomorrow, so the
   * questionnaire and the review step show AiLimitNotice. */
  const isAiFillCapReached = computed(() => aiUsage.value?.fillCapReached ?? false)

  async function refreshAiUsage(): Promise<void> {
    try {
      aiUsage.value = await aiTextsApi.getUsage(getOrCreateGuestId())
    } catch {
      // Best-effort — the counter just doesn't show.
    }
  }

  function isLimitError(err: unknown): boolean {
    return isAxiosError(err) && err.response?.status === 429
  }

  /** Writes generated texts into a local draft page as `source: 'AI'` — skipping parts the
   * customer edited by hand, unless `overwrite` names them (a deliberate regenerate). `sourceHash`
   * fingerprints the answers they came from; `countUpdate` spends one of a guest's per-block
   * automatic updates. */
  function writeLocalAiTexts(
    journalPageId: string,
    texts: Record<string, string>,
    overwrite: Set<string> = new Set(),
    meta: { sourceHash?: string | null; countUpdate?: boolean } = {},
  ): void {
    if (!order.value) {
      return
    }
    const pageIndex = order.value.journalPages.findIndex((page) => page.id === journalPageId)
    if (pageIndex === -1) {
      return
    }
    const page = order.value.journalPages[pageIndex]
    const byElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
    for (const [elementId, text] of Object.entries(texts)) {
      const existing = byElementId.get(elementId)
      if (!text?.trim() || (existing?.source === 'OVERRIDDEN' && !overwrite.has(elementId))) {
        continue
      }
      byElementId.set(elementId, {
        id: existing?.id ?? `local-ai-${Date.now()}-${elementId}`,
        elementId,
        valueType: 'TEXT',
        textValue: text.trim(),
        jsonValue: null,
        source: 'AI',
        aiSourceHash: meta.sourceHash ?? null,
        aiAutoUpdates: (existing?.aiAutoUpdates ?? 0) + (meta.countUpdate ? 1 : 0),
      })
    }
    order.value.journalPages[pageIndex] = { ...page, placeholderValues: [...byElementId.values()] }
    persistLocalDraft()
  }

  /** One draft generation request — keeps `aiUsage` in step with what the server reports, and
   * marks the matching counter as used up on a 429 so the UI reflects it right away. */
  async function requestDraftAiText(
    page: JournalPage,
    elementId: string,
    scope: 'all' | 'part',
    purpose: DraftAiTextPurpose,
    extra: Pick<GenerateDraftAiTextPayload, 'currentTexts' | 'journalTexts'> = {},
  ): Promise<Record<string, string>> {
    if (!order.value) {
      throw new Error('Заказ не загружен.')
    }
    try {
      const result = await aiTextsApi.generateForDraft({
        guestId: getOrCreateGuestId(),
        magazineTypeId: order.value.magazineTypeId,
        page: draftPagePayload(page),
        elementId,
        scope,
        purpose,
        answers: draftAnswersPayload(order.value.questionAnswers),
        ...extra,
      })
      aiUsage.value = result.usage
      return result.texts
    } catch (err) {
      if (isLimitError(err) && aiUsage.value) {
        // Same split as the backend: a guest's update draws on the fill cap, a customer's on the
        // regeneration limit.
        const isFill = purpose === 'fill' || (purpose === 'update' && aiUsage.value.isGuest)
        aiUsage.value = isFill
          ? { ...aiUsage.value, fillCapReached: true }
          : { ...aiUsage.value, used: aiUsage.value.limit, remaining: 0 }
      }
      throw err
    }
  }

  /** The local-draft counterpart of `OrdersService.generateAiTextForElements`: every
   * question-driven text that's missing or outdated (see questionAiTextStatuses) is written. An
   * update is skipped once a guest's block used up its automatic updates, or at the customer's
   * regeneration limit — the old text stays and is flagged as outdated. Best-effort: a failed
   * text is skipped, the rest still go. */
  async function generateLocalAiTextsForAnswers(changedKeys: Set<string>, onlyPageId?: string): Promise<void> {
    if (!order.value) {
      return
    }
    const pages = order.value.journalPages.filter((page) => !onlyPageId || page.id === onlyPageId)
    const statuses = questionAiTextStatuses(pages, answerMapOf(order.value.questionAnswers), changedKeys)

    for (const status of statuses) {
      if (status.state === 'up-to-date') {
        continue
      }
      const isUpdate = status.state === 'outdated'
      const usage = aiUsage.value
      const isGuest = !useAuthStore().isAuthenticated
      const canGenerate = isUpdate
        ? isGuest
          ? status.autoUpdates < (usage?.guestAutoUpdatesPerText ?? Infinity)
          : (usage?.remaining ?? 1) > 0
        : !usage?.fillCapReached
      const page = order.value?.journalPages.find((candidate) => candidate.id === status.journalPageId)
      if (!canGenerate || !page) {
        continue
      }

      try {
        const texts = await requestDraftAiText(page, status.parts[0].id, 'all', isUpdate ? 'update' : 'fill')
        writeLocalAiTexts(page.id, texts, new Set(), {
          sourceHash: status.sourceHash,
          countUpdate: isUpdate && isGuest,
        })
      } catch {
        // Best-effort — see the doc comment; a 429 already marked the counter as used up.
      }
    }
  }

  /** Brings the journal's question-driven AI texts up to date with the saved answers — the
   * questionnaire calls this when a step is left (saving an answer doesn't generate any more).
   * Never throws. For a real order only the AI texts are taken from the response: an answer
   * autosaved while this was running must not be rolled back by its older snapshot. */
  async function generateAiTextsForAnswers(changedKeys: Iterable<string>): Promise<void> {
    if (!order.value) {
      return
    }
    try {
      if (isLocalDraft.value) {
        await generateLocalAiTextsForAnswers(new Set(changedKeys))
        return
      }
      const result = await ordersApi.generateAiTexts(order.value.id, [...changedKeys])
      mergeAiTextsFrom(result)
    } catch {
      // Best-effort — the texts just stay as they were.
    } finally {
      void refreshAiUsage()
    }
  }

  function mergeAiTextsFrom(source: OrderDetail): void {
    if (!order.value) {
      return
    }
    const sourcePages = new Map(source.journalPages.map((page) => [page.id, page]))
    order.value.journalPages = order.value.journalPages.map((page) => {
      const aiValues = (sourcePages.get(page.id)?.placeholderValues ?? []).filter((value) => value.source === 'AI')
      if (aiValues.length === 0) {
        return page
      }
      const byElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
      for (const value of aiValues) {
        // A part edited by hand meanwhile wins over the generated text.
        if (byElementId.get(value.elementId)?.source !== 'OVERRIDDEN') {
          byElementId.set(value.elementId, value)
        }
      }
      return { ...page, placeholderValues: [...byElementId.values()] }
    })
  }

  /** The local-draft counterpart of `OrdersService.generateJournalAiTexts` — fills every still
   * empty journal-wide text (cover lines): a whole set at once, or each missing part alone with
   * the existing ones as context. Best-effort, stops at the daily limit. */
  async function generateLocalJournalAiTexts(): Promise<void> {
    if (!order.value) {
      return
    }

    for (const page of [...order.value.journalPages]) {
      for (const parts of aiTextGroupsOf(page)) {
        if (parts[0].contentSource !== 'journal') {
          continue
        }
        const current = () => order.value!.journalPages.find((candidate) => candidate.id === page.id) ?? page
        const missing = parts.filter((part) => !textOf(current(), part.id))
        if (missing.length === 0) {
          continue
        }
        const journalTexts = collectDraftJournalTexts(order.value.journalPages, new Set(parts.map((part) => part.id)))

        try {
          if (missing.length === parts.length) {
            writeLocalAiTexts(page.id, await requestDraftAiText(current(), parts[0].id, 'all', 'fill', { journalTexts }))
            continue
          }
          for (const part of missing) {
            const currentTexts = parts
              .map((other) => ({ elementId: other.id, text: textOf(current(), other.id) }))
              .filter((item) => item.text)
            writeLocalAiTexts(
              page.id,
              await requestDraftAiText(current(), part.id, 'part', 'fill', { journalTexts, currentTexts }),
            )
          }
        } catch (err) {
          if (isLimitError(err)) {
            return
          }
        }
      }
    }
  }

  /** Whether the journal holds any text written from the whole journal (cover lines etc.) —
   * gates the end-of-questionnaire generation call, so journals without one skip the round-trip. */
  function hasJournalWideAiTexts(): boolean {
    return (order.value?.journalPages ?? []).some((page) =>
      flattenTree(normalizeCanvasData(page.pageSnapshot).elements).some(
        (leaf) => isAiTextElement(leaf) && leaf.contentSource === 'journal',
      ),
    )
  }

  /** Fills the journal-wide AI texts that are still empty (see ordersApi.generateJournalAiTexts,
   * or generateLocalJournalAiTexts for a guest's local draft). Never throws: a failure just leaves
   * the cover lines on their placeholder, the customer can still regenerate them later. */
  async function generateJournalAiTexts(): Promise<void> {
    if (!order.value || !hasJournalWideAiTexts()) {
      return
    }
    try {
      if (isLocalDraft.value) {
        await generateLocalJournalAiTexts()
      } else {
        order.value = await ordersApi.generateJournalAiTexts(order.value.id)
      }
    } catch {
      // Best-effort — see the doc comment.
    } finally {
      void refreshAiUsage()
    }
  }

  /** A fresh AI-generated variant for one ai-text-placeholder, same feeding answers — the "🔄"
   * icon on the questionnaire book preview. Needs a real backend order (YandexGPT runs
   * server-side): callers should gate this on `!isLocalDraft` rather than let it throw. The
   * endpoint only returns the new text, not a full order, so the affected placeholder value is
   * patched in place here rather than round-tripping a full refetch. */
  async function regenerateAiText(journalPageId: string, elementId: string): Promise<string> {
    if (!order.value) {
      throw new Error('Заказ не загружен.')
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        return await regenerateLocalAiText(journalPageId, elementId)
      }

      const text = await ordersApi.regenerateAiText(order.value.id, journalPageId, elementId)

      const pageIndex = order.value.journalPages.findIndex((page) => page.id === journalPageId)
      if (pageIndex !== -1) {
        const page = order.value.journalPages[pageIndex]
        const byElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
        byElementId.set(elementId, {
          id: byElementId.get(elementId)?.id ?? `ai-text-${Date.now()}-${elementId}`,
          elementId,
          valueType: 'TEXT',
          textValue: text,
          jsonValue: null,
          source: 'AI',
        })
        order.value.journalPages[pageIndex] = { ...page, placeholderValues: [...byElementId.values()] }
      }

      return text
    } catch (err) {
      // The server's own message carries the daily-limit explanation (429) — see AiUsageService.
      orderError.value = extractApiErrorMessage(err, 'Не удалось сгенерировать новый вариант текста.')
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
      void refreshAiUsage()
    }
  }

  /** A guest's "regenerate" on one block — only that part is rewritten (the others, possibly
   * hand-edited, are sent along as context), same as the order flow's `regenerateAiText`. */
  async function regenerateLocalAiText(journalPageId: string, elementId: string): Promise<string> {
    const page = order.value?.journalPages.find((candidate) => candidate.id === journalPageId)
    const parts = page ? aiTextGroupsOf(page).find((group) => group.some((part) => part.id === elementId)) : null
    if (!order.value || !page || !parts) {
      throw new Error('Блок не найден.')
    }

    const currentTexts = parts
      .filter((part) => part.id !== elementId)
      .map((part) => ({ elementId: part.id, text: textOf(page, part.id) }))
      .filter((item) => item.text)
    const journalTexts =
      parts[0].contentSource === 'journal'
        ? collectDraftJournalTexts(order.value.journalPages, new Set(parts.map((part) => part.id)))
        : undefined

    const texts = await requestDraftAiText(page, elementId, 'part', 'regenerate', { currentTexts, journalTexts })
    // Written from today's answers — which also clears an "outdated" flag.
    const lead = parts[0]
    const sourceHash =
      lead.contentSource === 'journal'
        ? null
        : aiAnswersSignature(lead.questionKeys, answerMapOf(order.value.questionAnswers))
    writeLocalAiTexts(journalPageId, texts, new Set([elementId]), { sourceHash })
    return texts[elementId] ?? ''
  }

  /** Adds a single spread — mirrors `OrdersService.addJournalSpread` on the backend. Printing
   * still requires the final page count to be a multiple of 4, but that's no longer enforced
   * per-action: SpreadManagerDialog.vue allows free one-at-a-time add/remove and only checks the
   * total when the user closes the manager. */
  function applyLocalAddSpread(): void {
    if (!order.value) {
      return
    }

    const spreadDefault =
      configuredDefaultSpreads.value.at(-1) ??
      pickDefaultSpreadTemplate(groupedTemplates.value)
    if (!spreadDefault) {
      throw new Error('NO_SPREAD_TEMPLATES')
    }

    const backCoverIndex = order.value.journalPages.findIndex((page) => page.slotType === 'BACK_COVER')
    const insertAt = backCoverIndex === -1 ? order.value.journalPages.length : backCoverIndex

    const primary = findTemplateById(templateCatalog.value, spreadDefault.magazinePageId)!
    const right = spreadDefault.rightMagazinePageId
      ? findTemplateById(templateCatalog.value, spreadDefault.rightMagazinePageId)
      : null

    const pageSnapshot = buildJournalPageSnapshot('SPREAD', spreadDefault.layoutMode, primary, right ?? null)

    const SPREADS_PER_ADD = 1
    const newPages: JournalPage[] = Array.from({ length: SPREADS_PER_ADD }, (_, i) => ({
      id: `local-spread-${Date.now()}-${i}`,
      sortOrder: insertAt + i,
      slotType: 'SPREAD',
      layoutMode: spreadDefault.layoutMode,
      pageSnapshot,
      magazinePage: toMagazinePageSummary(primary),
      rightMagazinePage: right ? toMagazinePageSummary(right) : null,
      placeholderValues: [],
    }))

    const nextPages = [...order.value.journalPages]
    nextPages.splice(insertAt, 0, ...newPages)
    order.value.journalPages = nextPages.map((page, index) => ({
      ...page,
      sortOrder: index,
    }))

    if (selectedMagazineType.value) {
      order.value.totalPrice = String(
        calculateJournalPrice(selectedMagazineType.value, countSpreadSlots(order.value.journalPages)),
      )
    }

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  async function addJournalSpread(): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalAddSpread()
        return
      }

      order.value = await ordersApi.addJournalSpread(order.value.id)
    } catch {
      orderError.value = 'Не удалось добавить разворот.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  function applyLocalReorderSpreads(spreadIds: string[]): void {
    if (!order.value) {
      return
    }

    const cover = order.value.journalPages.find((page) => page.slotType === 'COVER')
    const backCover = order.value.journalPages.find((page) => page.slotType === 'BACK_COVER')
    // Mirrors orders.service.ts's own reorderJournalSpreads — never accepted in spreadIds, so it
    // can only ever sit right after the cover.
    const toc = order.value.journalPages.find((page) => page.slotType === 'TOC')
    const spreads = order.value.journalPages.filter((page) => page.slotType === 'SPREAD')

    if (!cover || !backCover || spreadIds.length !== spreads.length) {
      return
    }

    const orderedSpreads = spreadIds.map((id) => spreads.find((page) => page.id === id)!)
    const nextOrder = toc ? [cover, toc, ...orderedSpreads, backCover] : [cover, ...orderedSpreads, backCover]
    order.value.journalPages = nextOrder.map((page, index) => ({
      ...page,
      sortOrder: index,
    }))

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  async function reorderJournalSpreads(spreadIds: string[]): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalReorderSpreads(spreadIds)
        return
      }

      order.value = await ordersApi.reorderJournalSpreads(order.value.id, spreadIds)
    } catch {
      orderError.value = 'Не удалось изменить порядок разворотов.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  /** Mirrors `OrdersService.removeJournalSpreads`'s soft-delete on the backend — moves spreads
   * into `trashedJournalPages` (most recently removed first, matching the backend's `deletedAt
   * desc` trash ordering) instead of discarding them, so `applyLocalRestoreSpread` can bring them
   * back with their photos/answers intact. */
  function applyLocalRemoveSpread(spreadIds: string[]): void {
    if (!order.value) {
      return
    }

    const removeIdSet = new Set(spreadIds)
    const removedPages = order.value.journalPages.filter((page) => removeIdSet.has(page.id))
    const nextPages = order.value.journalPages.filter((page) => !removeIdSet.has(page.id))
    order.value.journalPages = nextPages.map((page, index) => ({
      ...page,
      sortOrder: index,
    }))

    const deletedAt = new Date().toISOString()
    trashedJournalPages.value = [
      ...removedPages.map((page) => ({ ...page, deletedAt })),
      ...trashedJournalPages.value,
    ]

    if (selectedMagazineType.value) {
      order.value.totalPrice = String(
        calculateJournalPrice(selectedMagazineType.value, countSpreadSlots(order.value.journalPages)),
      )
    }

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  async function removeJournalSpread(spreadIds: string[]): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalRemoveSpread(spreadIds)
        return
      }

      order.value = await ordersApi.removeJournalSpreads(order.value.id, spreadIds)
    } catch {
      orderError.value = 'Не удалось удалить развороты.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  /** Mirrors `OrdersService.restoreJournalSpread` — re-inserts right before the back cover (same
   * insertion point `applyLocalAddSpread` uses), not the spread's original position. */
  function applyLocalRestoreSpread(spreadId: string): void {
    if (!order.value) {
      return
    }

    const trashIndex = trashedJournalPages.value.findIndex((page) => page.id === spreadId)
    if (trashIndex === -1) {
      return
    }

    // `TrashedJournalPage` is a `JournalPage` plus `deletedAt` — restoring just drops it back into
    // `journalPages` as-is; the extra field is harmless there (structurally still a `JournalPage`).
    const restoredPage = trashedJournalPages.value[trashIndex]
    trashedJournalPages.value = trashedJournalPages.value.filter((page) => page.id !== spreadId)

    const backCoverIndex = order.value.journalPages.findIndex((page) => page.slotType === 'BACK_COVER')
    const insertAt = backCoverIndex === -1 ? order.value.journalPages.length : backCoverIndex

    const nextPages = [...order.value.journalPages]
    nextPages.splice(insertAt, 0, restoredPage)
    order.value.journalPages = nextPages.map((page, index) => ({
      ...page,
      sortOrder: index,
    }))

    if (selectedMagazineType.value) {
      order.value.totalPrice = String(
        calculateJournalPrice(selectedMagazineType.value, countSpreadSlots(order.value.journalPages)),
      )
    }

    if (isLocalDraft.value) {
      persistLocalDraft()
    }
  }

  async function restoreJournalSpread(spreadId: string): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
      if (isLocalDraft.value) {
        applyLocalRestoreSpread(spreadId)
        return
      }

      order.value = await ordersApi.restoreJournalSpread(order.value.id, spreadId)
    } catch {
      orderError.value = 'Не удалось восстановить разворот.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  async function fetchTrashedJournalSpreads(): Promise<TrashedJournalPage[]> {
    if (!order.value) {
      return []
    }

    if (isLocalDraft.value) {
      return trashedJournalPages.value
    }

    return ordersApi.fetchTrashedJournalSpreads(order.value.id)
  }

  function collectMissingRequiredPlaceholders(): Array<{
    journalPageId: string
    pageName: string
    elementId: string
    label: string
  }> {
    if (!order.value) {
      return []
    }

    const missing: Array<{
      journalPageId: string
      pageName: string
      elementId: string
      label: string
    }> = []

    for (const journalPage of order.value.journalPages) {
      const canvas = normalizeCanvasData(journalPage.pageSnapshot)
      const valuesByElement = new Map(
        journalPage.placeholderValues.map((value) => [value.elementId, value]),
      )

      for (const element of canvas.elements) {
        if (!isFillableElement(element)) {
          continue
        }

        const isRequired = Boolean((element as { required?: boolean }).required)
        if (!isRequired) {
          continue
        }

        const value = valuesByElement.get(element.id)
        if (!isPlaceholderFilled(element, value)) {
          missing.push({
            journalPageId: journalPage.id,
            pageName: journalPage.magazinePage.name,
            elementId: element.id,
            label:
              element.type === 'photo-placeholder'
                ? element.label
                : (element as { label: string }).label,
          })
        }
      }
    }

    return missing
  }

  /** Groups `collectMissingRequiredPlaceholders()` by page, in journal order, with a human page
   * label ("Обложка" / "Разворот 2" / "Задняя обложка") — feeds the "what exactly is missing"
   * modal shown when submit validation fails, so the user gets a page-by-page checklist instead
   * of a single generic error line. */
  function collectIncompletePages(): Array<{
    journalPageId: string
    pageLabel: string
    missingLabels: string[]
  }> {
    if (!order.value) {
      return []
    }

    const missing = collectMissingRequiredPlaceholders()
    if (missing.length === 0) {
      return []
    }

    let spreadIndex = 0
    const spreadIndexByPageId = new Map<string, number>()
    for (const page of order.value.journalPages) {
      if (page.slotType === 'SPREAD') {
        spreadIndex += 1
        spreadIndexByPageId.set(page.id, spreadIndex)
      }
    }

    const missingLabelsByPageId = new Map<string, string[]>()
    for (const item of missing) {
      const labels = missingLabelsByPageId.get(item.journalPageId) ?? []
      labels.push(item.label)
      missingLabelsByPageId.set(item.journalPageId, labels)
    }

    return order.value.journalPages
      .filter((page) => missingLabelsByPageId.has(page.id))
      .map((page) => ({
        journalPageId: page.id,
        pageLabel: getJournalPageDisplayName(page, spreadIndexByPageId.get(page.id)),
        missingLabels: missingLabelsByPageId.get(page.id)!,
      }))
  }

  /** Client-side mirror of what the backend re-checks anyway on submit — run before either
   * `convertLocalDraftToOrder()` (no point requiring sign-in for a journal that isn't ready) or
   * `submitOrder()`. Returns a user-facing message, or `null` if the journal is submittable. */
  function getSubmitValidationError(): string | null {
    if (!order.value) {
      return 'Заказ не загружен.'
    }

    const spreadCount = countSpreadSlots(order.value.journalPages)
    if (spreadCount < MIN_JOURNAL_SPREADS) {
      return `В журнале должно быть минимум ${MIN_JOURNAL_SPREADS} разворотов.`
    }

    if (collectMissingRequiredPlaceholders().length > 0) {
      return 'Заполните все обязательные поля перед продолжением.'
    }

    return null
  }

  /** Removes one gallery photo from every spread slot that still shows it. */
  async function removePhotoFromJournal(url: string): Promise<void> {
    if (!order.value || !url.trim()) {
      return
    }

    const pages = stripPhotoUrlFromJournalPages(order.value.journalPages, url)
    const trash = stripPhotoUrlFromJournalPages(trashedJournalPages.value, url)
    if (!pages.changed && !trash.changed) {
      return
    }

    order.value = { ...order.value, journalPages: pages.pages }
    trashedJournalPages.value = trash.pages

    if (isLocalDraft.value) {
      persistLocalDraft()
      return
    }

    const snapshotChanged = new Set(pages.snapshotChangedPageIds)
    for (const page of pages.pages) {
      if (!snapshotChanged.has(page.id) || !order.value) {
        continue
      }
      order.value = await ordersApi.saveJournalPageCanvas(order.value.id, page.id, page.pageSnapshot)
      if (page.placeholderValues.length > 0 && order.value) {
        order.value = await ordersApi.savePlaceholders(
          order.value.id,
          page.id,
          page.placeholderValues.map((value) => ({
            elementId: value.elementId,
            valueType: value.valueType,
            textValue: value.textValue ?? undefined,
            jsonValue: value.jsonValue ?? undefined,
          })),
        )
      }
    }

    for (const clear of pages.clearedPlaceholderElementIdsByPageId) {
      if (snapshotChanged.has(clear.pageId) || !order.value) {
        continue
      }
      order.value = await ordersApi.savePlaceholders(
        order.value.id,
        clear.pageId,
        clear.elementIds.map((elementId) => ({
          elementId,
          valueType: 'PHOTO',
          jsonValue: { url: '' },
        })),
      )
    }
  }

  /** Moves one guest journal onto a real order, including its gallery. The local draft stays
   * until the gallery claim and the saved answers/texts have succeeded, so a retry cannot leave
   * an empty gallery or create a second order (`adoptedOrderId`). */
  async function convertLocalDraftToOrder(): Promise<OrderDetail> {
    if (!order.value || !selectedMagazineType.value) {
      throw new Error('Order is not loaded')
    }

    const localId = order.value.id
    const galleryId = guestGalleryId.value ?? getOrCreateGuestId()
    const magazineTypeId = selectedMagazineType.value.id
    const journalPages: CreateOrderJournalPagePayload[] = order.value.journalPages.map((page) => ({
      slotType: page.slotType,
      layoutMode: page.layoutMode,
      magazinePageId: page.magazinePage.id,
      rightMagazinePageId: page.rightMagazinePage?.id ?? null,
      sortOrder: page.sortOrder,
      pageSnapshot: page.pageSnapshot,
    }))
    const localAnswers = order.value.questionAnswers
    const localAiTextsBySortOrder = new Map(
      order.value.journalPages.map((page) => {
        const aiTextIds = new Set(aiTextGroupsOf(page).flat().map((part) => part.id))
        const values = page.placeholderValues.filter((value) => aiTextIds.has(value.elementId) && value.textValue?.trim())
        return [page.sortOrder, values] as const
      }),
    )

    let serverOrder: OrderDetail
    const adoptedId = readLocalDraft(localId)?.adoptedOrderId
    if (adoptedId) {
      try {
        serverOrder = await ordersApi.getOne(adoptedId)
      } catch {
        serverOrder = await ordersApi.createDraft(magazineTypeId, journalPages)
        markLocalDraftAdopted(localId, serverOrder.id)
      }
    } else {
      serverOrder = await ordersApi.createDraft(magazineTypeId, journalPages)
      markLocalDraftAdopted(localId, serverOrder.id)
    }

    try {
      serverOrder = await retryAsync(async () => {
        const before = await photoGalleryApi.list({ guestId: galleryId })
        if (before.length > 0) {
          await photoGalleryApi.claimGuestPhotos(galleryId, serverOrder.id)
          const after = await photoGalleryApi.list({ orderId: serverOrder.id })
          if (!claimedGalleryCovers(before.map((photo) => photo.id), after.map((photo) => photo.id))) {
            throw new Error('GUEST_GALLERY_CLAIM_INCOMPLETE')
          }
        }

        let current = serverOrder
        for (const page of current.journalPages) {
          const values = localAiTextsBySortOrder.get(page.sortOrder) ?? []
          if (values.length === 0) {
            continue
          }
          current = await ordersApi.savePlaceholders(
            current.id,
            page.id,
            values.map((value) => ({
              elementId: value.elementId,
              valueType: 'TEXT',
              textValue: value.textValue ?? '',
            })),
          )
        }
        if (localAnswers.length > 0) {
          current = await ordersApi.saveQuestionnaireAnswers(
            current.id,
            localAnswers.map((answer) => ({
              questionKey: answer.questionKey,
              textValue: answer.textValue ?? undefined,
              jsonValue: answer.jsonValue ?? undefined,
            })),
          )
        }
        return current
      })
    } catch {
      orderError.value =
        'Не удалось перенести фото и данные журнала в аккаунт. Черновик сохранён — попробуйте ещё раз.'
      throw new Error(orderError.value)
    }

    removeLocalDraft(localId)
    order.value = serverOrder
    isLocalDraft.value = false
    guestGalleryId.value = null

    await generateAiTextsForAnswers([])
    await generateJournalAiTexts()

    return order.value
  }

  /** Turns every guest journal still stored in this browser into a real order. The one open in
   * this tab is converted last, so it stays the current order afterwards. */
  async function adoptAllGuestDrafts(): Promise<void> {
    if (isLocalDraft.value && order.value && !persistLocalDraft()) {
      throw new Error(orderError.value ?? 'Не удалось сохранить черновик.')
    }

    const currentId = isLocalDraft.value ? order.value?.id ?? null : null
    const drafts = readLocalDrafts()
    const ordered = [
      ...drafts.filter((draft) => draft.id !== currentId && draft.order.id !== currentId),
      ...drafts.filter((draft) => draft.id === currentId || draft.order.id === currentId),
    ]

    for (const draft of ordered) {
      await restoreLocalDraft(draft)
      await convertLocalDraftToOrder()
    }
  }

  async function submitOrder(): Promise<OrderDetail> {
    if (!order.value) {
      throw new Error('Order is not loaded')
    }

    if (isLocalDraft.value) {
      throw new Error('Order must be created on the server before it can be submitted.')
    }

    isSubmitting.value = true
    orderError.value = null

    try {
      order.value = await ordersApi.submit(order.value.id)
      return order.value
    } catch (err: unknown) {
      if (!orderError.value) {
        const response = (err as { response?: { data?: { message?: string | { message?: string } } } })
          ?.response?.data?.message

        if (typeof response === 'string') {
          orderError.value = response
        } else if (response && typeof response === 'object' && 'message' in response) {
          orderError.value = String(response.message)
        } else {
          orderError.value = 'Заполните все обязательные поля перед отправкой.'
        }
      }

      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  function resetOrderFlow(): void {
    order.value = null
    templateCatalog.value = []
    configuredDefaultSpreads.value = []
    isLocalDraft.value = false
    guestGalleryId.value = null
    orderError.value = null
  }

  return {
    magazineTypes,
    isLoadingTypes,
    loadError,
    fetchMagazineTypes,
    selectedMagazineType,
    selectMagazineType,
    clearSelection,
    templateCatalog,
    groupedTemplates,
    order,
    isLocalDraft,
    guestGalleryId,
    isLoadingOrder,
    isSaving,
    isSubmitting,
    orderError,
    loadLocalDraft,
    restoreLocalDraft,
    startDraft,
    createDraftOrder,
    loadOrder,
    applyJournalPageCanvasEdit,
    setJournalPageTemplate,
    saveQuestionnaireAnswers,
    savePlaceholders,
    regenerateAiText,
    generateJournalAiTexts,
    aiUsage,
    isAiFillCapReached,
    generateAiTextsForAnswers,
    hasJournalWideAiTexts,
    refreshAiUsage,
    addJournalSpread,
    reorderJournalSpreads,
    removeJournalSpread,
    trashedJournalPages,
    restoreJournalSpread,
    fetchTrashedJournalSpreads,
    getSubmitValidationError,
    collectIncompletePages,
    convertLocalDraftToOrder,
    adoptAllGuestDrafts,
    removePhotoFromJournal,
    submitOrder,
    resetOrderFlow,
  }
})
