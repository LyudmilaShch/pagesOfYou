import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { catalogApi, type CatalogMagazinePage } from '../api/catalog.api'
import {
  ordersApi,
  type CreateOrderJournalPagePayload,
  type SetJournalPageTemplatePayload,
} from '../api/orders.api'
import { photoGalleryApi } from '../api/photo-gallery.api'
import { getOrCreateGuestId } from '@/shared/utils/guest-id.util'
import { clearLocalDraft, saveLocalDraft, type StoredLocalDraft } from '../utils/local-draft-storage.util'
import { calculateJournalPrice } from '../utils/pricing.util'
import { useAuthStore } from '@/stores/auth.store'
import { MIN_JOURNAL_SPREADS } from '../constants/journal.constants'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { MagazineType } from '../types/magazine-type'
import type { JournalPage, OrderDetail, PlaceholderInput, QuestionAnswerInput } from '../types/order.types'
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
    configuredSpreads?: DefaultSpreadTemplate[],
  ): JournalPage[] {
    const catalog = groupTemplatesByPageType(templates)

    if (catalog.cover.length === 0) {
      throw new Error('MISSING_COVER_TEMPLATES')
    }

    const slots = buildInitialJournalSlots(templates, { configuredSpreads })

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
        configuredDefaultSpreads.value.length > 0
          ? configuredDefaultSpreads.value
          : undefined,
      )
      const totalPrice = calculateJournalPrice(magazineType, countSpreadSlots(journalPages))

      order.value = {
        id: `local-${magazineTypeId}`,
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

      saveLocalDraft(magazineTypeId, order.value)
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
      saveLocalDraft(order.value.magazineTypeId, order.value)
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
      saveLocalDraft(order.value.magazineTypeId, order.value)
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
    saveLocalDraft(order.value.magazineTypeId, order.value)
  }

  async function saveQuestionnaireAnswers(answers: QuestionAnswerInput[]): Promise<void> {
    if (!order.value) {
      return
    }

    isSaving.value = true
    orderError.value = null

    try {
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

    saveLocalDraft(order.value.magazineTypeId, order.value)
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

  /** A fresh AI-generated variant for one ai-text-placeholder, same feeding answers — the "🔄"
   * icon on the questionnaire book preview. Needs a real backend order (YandexGPT runs
   * server-side): callers should gate this on `!isLocalDraft` rather than let it throw. The
   * endpoint only returns the new text, not a full order, so the affected placeholder value is
   * patched in place here rather than round-tripping a full refetch. */
  async function regenerateAiText(journalPageId: string, elementId: string): Promise<string> {
    if (!order.value) {
      throw new Error('Заказ не загружен.')
    }
    if (isLocalDraft.value) {
      throw new Error('Сначала сохраните заказ, чтобы сгенерировать новый вариант текста.')
    }

    isSaving.value = true
    orderError.value = null

    try {
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
    } catch {
      orderError.value = 'Не удалось сгенерировать новый вариант текста.'
      throw new Error(orderError.value)
    } finally {
      isSaving.value = false
    }
  }

  /** Adds 2 spreads (= 4 pages) at once, never 1 — printing requires page counts in multiples of
   * 4 (signature/tetrad binding), mirrors `OrdersService.addJournalSpread` on the backend. */
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

    const SPREADS_PER_ADD = 2
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
      saveLocalDraft(order.value.magazineTypeId, order.value)
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
    const spreads = order.value.journalPages.filter((page) => page.slotType === 'SPREAD')

    if (!cover || !backCover || spreadIds.length !== spreads.length) {
      return
    }

    const orderedSpreads = spreadIds.map((id) => spreads.find((page) => page.id === id)!)
    order.value.journalPages = [cover, ...orderedSpreads, backCover].map((page, index) => ({
      ...page,
      sortOrder: index,
    }))

    if (isLocalDraft.value) {
      saveLocalDraft(order.value.magazineTypeId, order.value)
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

  /** Turns a guest's in-memory draft into a real order — persists exactly the pages/content
   * already assembled locally (spreads, templates, placed photos/text) instead of seeding fresh
   * default pages. Best-effort re-parents the guest's gallery photos onto the new order; a
   * failure there doesn't block the order itself (see `claimGuestPhotos`'s own doc comment). */
  async function convertLocalDraftToOrder(): Promise<OrderDetail> {
    if (!order.value || !selectedMagazineType.value) {
      throw new Error('Order is not loaded')
    }

    const journalPages: CreateOrderJournalPagePayload[] = order.value.journalPages.map((page) => ({
      slotType: page.slotType,
      layoutMode: page.layoutMode,
      magazinePageId: page.magazinePage.id,
      rightMagazinePageId: page.rightMagazinePage?.id ?? null,
      sortOrder: page.sortOrder,
      pageSnapshot: page.pageSnapshot,
    }))
    // Captured before `order.value` is replaced below — the guest's locally-held answers (see
    // `applyLocalQuestionAnswers`) have nowhere else to come from once this local draft is gone.
    const localAnswers = order.value.questionAnswers

    order.value = await ordersApi.createDraft(selectedMagazineType.value.id, journalPages)
    isLocalDraft.value = false
    // This local draft is now a real backend order — its localStorage mirror (if any) would
    // otherwise wrongly resurface as "continue your draft?" on a later visit to /order/create.
    clearLocalDraft()

    try {
      await photoGalleryApi.claimGuestPhotos(getOrCreateGuestId(), order.value.id)
    } catch {
      // Best-effort — the order itself is already created; the guest's gallery photos just stay
      // under the old guestId and won't show up in this order's gallery. Not fatal.
    }

    if (localAnswers.length > 0) {
      try {
        order.value = await ordersApi.saveQuestionnaireAnswers(
          order.value.id,
          localAnswers.map((answer) => ({
            questionKey: answer.questionKey,
            textValue: answer.textValue ?? undefined,
            jsonValue: answer.jsonValue ?? undefined,
          })),
        )
      } catch {
        // Best-effort, same reasoning as claimGuestPhotos above — the order already exists; the
        // user can re-fill the questionnaire if this push fails.
      }
    }

    return order.value
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
    addJournalSpread,
    reorderJournalSpreads,
    getSubmitValidationError,
    collectIncompletePages,
    convertLocalDraftToOrder,
    submitOrder,
    resetOrderFlow,
  }
})
