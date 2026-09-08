import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { catalogApi, type CatalogMagazinePage } from '../api/catalog.api'
import { ordersApi, type SetJournalPageTemplatePayload } from '../api/orders.api'
import { MIN_JOURNAL_SPREADS } from '../constants/journal.constants'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { MagazineType } from '../types/magazine-type'
import type { JournalPage, OrderDetail } from '../types/order.types'
import {
  buildInitialJournalSlots,
  buildJournalPageSnapshot,
  countSpreadSlots,
  findTemplateById,
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

  async function loadLocalDraft(magazineTypeId: string): Promise<void> {
    isLoadingOrder.value = true
    orderError.value = null
    isLocalDraft.value = true

    try {
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

      const catalog = groupTemplatesByPageType(pages)
      if (catalog.cover.length === 0) {
        orderError.value = 'Для журнала нужен шаблон обложки.'
        throw new Error(orderError.value)
      }

      selectedMagazineType.value = magazineType

      order.value = {
        id: `local-${magazineTypeId}`,
        status: 'DRAFT',
        magazineTypeId,
        totalPrice: magazineType.basePrice != null ? String(magazineType.basePrice) : null,
        magazineType: {
          id: magazineType.id,
          name: magazineType.name,
          slug: '',
          coverImage: magazineType.image || null,
          basePrice: magazineType.basePrice != null ? String(magazineType.basePrice) : null,
          oldPrice: magazineType.oldPrice != null ? String(magazineType.oldPrice) : null,
        },
        journalPages: buildLocalJournalPages(
          pages,
          magazineTypeId,
          configuredDefaultSpreads.value.length > 0
            ? configuredDefaultSpreads.value
            : undefined,
        ),
      }
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

    const newPage: JournalPage = {
      id: `local-spread-${Date.now()}`,
      sortOrder: insertAt,
      slotType: 'SPREAD',
      layoutMode: spreadDefault.layoutMode,
      pageSnapshot: buildJournalPageSnapshot(
        'SPREAD',
        spreadDefault.layoutMode,
        primary,
        right ?? null,
      ),
      magazinePage: toMagazinePageSummary(primary),
      rightMagazinePage: right ? toMagazinePageSummary(right) : null,
      placeholderValues: [],
    }

    const nextPages = [...order.value.journalPages]
    nextPages.splice(insertAt, 0, newPage)
    order.value.journalPages = nextPages.map((page, index) => ({
      ...page,
      sortOrder: index,
    }))
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

  async function submitOrder(): Promise<OrderDetail> {
    if (!order.value) {
      throw new Error('Order is not loaded')
    }

    isSubmitting.value = true
    orderError.value = null

    try {
      const spreadCount = countSpreadSlots(order.value.journalPages)
      if (spreadCount < MIN_JOURNAL_SPREADS) {
        orderError.value = `В журнале должно быть минимум ${MIN_JOURNAL_SPREADS} разворотов.`
        throw new Error(orderError.value)
      }

      if (isLocalDraft.value) {
        const missing = collectMissingRequiredPlaceholders()
        if (missing.length > 0) {
          orderError.value = 'Заполните все обязательные поля перед продолжением.'
          throw new Error(orderError.value)
        }

        return order.value
      }

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
    createDraftOrder,
    loadOrder,
    applyJournalPageCanvasEdit,
    setJournalPageTemplate,
    addJournalSpread,
    reorderJournalSpreads,
    submitOrder,
    resetOrderFlow,
  }
})
