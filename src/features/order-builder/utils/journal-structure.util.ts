import {
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import {
  DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
} from '@/modules/editor/models/page-background.model'
import {
  CANVAS_DATA_VERSION,
  createEmptyCanvasData,
  createSpreadCanvasData,
  normalizeCanvasData,
  type CanvasData,
} from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import type { CatalogMagazinePage } from '../api/catalog.api'
import {
  JOURNAL_SLOT_LABELS,
  MIN_JOURNAL_SPREADS,
  type JournalSpreadLayout,
  type JournalSlotType,
} from '../constants/journal.constants'

export interface TemplateCatalog {
  cover: CatalogMagazinePage[]
  spread: CatalogMagazinePage[]
  page: CatalogMagazinePage[]
  backCover: CatalogMagazinePage[]
}

export interface DefaultSpreadTemplate {
  layoutMode: JournalSpreadLayout
  magazinePageId: string
  rightMagazinePageId: string | null
}

function cloneElementWithOffset(
  element: PageElement,
  idPrefix: string,
  xOffset: number,
): PageElement {
  return {
    ...element,
    id: `${idPrefix}${element.id}`,
    position: {
      ...element.position,
      x: element.position.x + xOffset,
    },
  }
}

export function mergePageCanvasesIntoSpread(
  leftCanvas: CanvasData,
  rightCanvas: CanvasData,
): CanvasData {
  const leftElements = leftCanvas.elements.map((element) =>
    cloneElementWithOffset(element, 'left-', 0),
  )
  const rightElements = rightCanvas.elements.map((element) =>
    cloneElementWithOffset(element, 'right-', A4_PAGE_WIDTH),
  )

  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    backgroundColor: leftCanvas.backgroundColor ?? rightCanvas.backgroundColor ?? '#FFFFFF',
    backgroundImageUrl: leftCanvas.backgroundImageUrl ?? rightCanvas.backgroundImageUrl ?? null,
    backgroundImageFit:
      leftCanvas.backgroundImageFit ??
      rightCanvas.backgroundImageFit ??
      DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
    backgroundImageCropX: leftCanvas.backgroundImageCropX ?? rightCanvas.backgroundImageCropX ?? 0,
    backgroundImageCropY: leftCanvas.backgroundImageCropY ?? rightCanvas.backgroundImageCropY ?? 0,
    backgroundImageScale: leftCanvas.backgroundImageScale ?? rightCanvas.backgroundImageScale ?? 1,
    elements: [...leftElements, ...rightElements],
  }
}

export function groupTemplatesByPageType(pages: CatalogMagazinePage[]): TemplateCatalog {
  return {
    cover: pages.filter((page) => page.pageType === 'COVER'),
    spread: pages.filter((page) => page.pageType === 'SPREAD'),
    page: pages.filter((page) => page.pageType === 'PAGE'),
    backCover: pages.filter((page) => page.pageType === 'BACK_COVER'),
  }
}

export interface BuildInitialJournalOptions {
  configuredSpreads?: DefaultSpreadTemplate[]
}

export function resolveInitialSpreadCount(
  configuredSpreads?: DefaultSpreadTemplate[],
): number {
  return Math.max(MIN_JOURNAL_SPREADS, configuredSpreads?.length ?? MIN_JOURNAL_SPREADS)
}

function resolveConfiguredSpreadAt(
  index: number,
  configuredSpreads: DefaultSpreadTemplate[] | undefined,
  spreadDefault: DefaultSpreadTemplate | null,
): DefaultSpreadTemplate | null {
  if (configuredSpreads && configuredSpreads.length > 0) {
    return configuredSpreads[index] ?? configuredSpreads[configuredSpreads.length - 1] ?? null
  }

  return spreadDefault
}

function resolveSpreadTemplates(
  config: DefaultSpreadTemplate | null,
  catalog: TemplateCatalog,
  templates: CatalogMagazinePage[],
): {
  layoutMode: JournalSpreadLayout | null
  primary: CatalogMagazinePage | null
  right: CatalogMagazinePage | null
} {
  if (!config) {
    return { layoutMode: null, primary: null, right: null }
  }

  if (config.layoutMode === 'SPLIT_PAGES') {
    const left =
      templates.find((page) => page.id === config.magazinePageId) ?? catalog.page[0] ?? null
    const right = config.rightMagazinePageId
      ? templates.find((page) => page.id === config.rightMagazinePageId) ?? catalog.page[1] ?? left
      : left

    return {
      layoutMode: 'SPLIT_PAGES',
      primary: left,
      right,
    }
  }

  const spreadTemplate =
    templates.find((page) => page.id === config.magazinePageId) ?? catalog.spread[0] ?? null

  return {
    layoutMode: spreadTemplate ? 'SPREAD' : null,
    primary: spreadTemplate,
    right: null,
  }
}

export function pickDefaultSpreadTemplate(catalog: TemplateCatalog): DefaultSpreadTemplate | null {
  if (catalog.spread.length > 0) {
    return {
      layoutMode: 'SPREAD',
      magazinePageId: catalog.spread[0].id,
      rightMagazinePageId: null,
    }
  }

  if (catalog.page.length >= 2) {
    return {
      layoutMode: 'SPLIT_PAGES',
      magazinePageId: catalog.page[0].id,
      rightMagazinePageId: catalog.page[1].id,
    }
  }

  if (catalog.page.length === 1) {
    return {
      layoutMode: 'SPLIT_PAGES',
      magazinePageId: catalog.page[0].id,
      rightMagazinePageId: catalog.page[0].id,
    }
  }

  return null
}

export function buildJournalPageSnapshot(
  slotType: JournalSlotType,
  layoutMode: JournalSpreadLayout | null,
  primaryTemplate: CatalogMagazinePage | null,
  rightTemplate: CatalogMagazinePage | null,
): CanvasData {
  if (!primaryTemplate) {
    return slotType === 'SPREAD' ? createSpreadCanvasData() : createEmptyCanvasData()
  }

  if (slotType === 'SPREAD') {
    const canvas =
      layoutMode === 'SPLIT_PAGES' && rightTemplate
        ? mergePageCanvasesIntoSpread(
            normalizeCanvasData(primaryTemplate.canvasData),
            normalizeCanvasData(rightTemplate.canvasData),
          )
        : normalizeCanvasData(primaryTemplate.canvasData)

    return {
      ...canvas,
      pageWidth: A4_SPREAD_PAGE_WIDTH,
      pageHeight: A4_SPREAD_PAGE_HEIGHT,
    }
  }

  return normalizeCanvasData(primaryTemplate.canvasData)
}

export interface LocalJournalSlotDraft {
  slotType: JournalSlotType
  layoutMode: JournalSpreadLayout | null
  magazinePageId: string
  rightMagazinePageId: string | null
  sortOrder: number
  pageSnapshot: CanvasData
}

export function buildInitialJournalSlots(
  templates: CatalogMagazinePage[],
  options: BuildInitialJournalOptions = {},
): LocalJournalSlotDraft[] {
  const catalog = groupTemplatesByPageType(templates)
  const coverTemplate = catalog.cover[0] ?? null
  const backCoverTemplate = catalog.backCover[0] ?? null
  const spreadDefault = pickDefaultSpreadTemplate(catalog)
  const spreadCount = resolveInitialSpreadCount(options.configuredSpreads)

  const fallbackTemplateId =
    catalog.spread[0]?.id ??
    catalog.page[0]?.id ??
    coverTemplate?.id ??
    backCoverTemplate?.id ??
    templates[0]?.id

  const slots: LocalJournalSlotDraft[] = []
  let sortOrder = 0

  const pushSlot = (
    slotType: JournalSlotType,
    layoutMode: JournalSpreadLayout | null,
    primary: CatalogMagazinePage | null,
    right: CatalogMagazinePage | null,
  ): void => {
    const primaryId =
      primary?.id ??
      (slotType === 'SPREAD' ? spreadDefault?.magazinePageId : null) ??
      fallbackTemplateId

    if (!primaryId) {
      return
    }

    slots.push({
      slotType,
      layoutMode,
      magazinePageId: primaryId,
      rightMagazinePageId: right?.id ?? null,
      sortOrder: sortOrder++,
      pageSnapshot: buildJournalPageSnapshot(slotType, layoutMode, primary, right),
    })
  }

  pushSlot('COVER', null, coverTemplate, null)

  for (let index = 0; index < spreadCount; index += 1) {
    const config = resolveConfiguredSpreadAt(
      index,
      options.configuredSpreads,
      spreadDefault,
    )
    const resolved = resolveSpreadTemplates(config, catalog, templates)

    pushSlot('SPREAD', resolved.layoutMode, resolved.primary, resolved.right)
  }

  pushSlot('BACK_COVER', null, backCoverTemplate, null)

  return slots
}

export function countSpreadSlots(pages: Array<{ slotType: JournalSlotType }>): number {
  return pages.filter((page) => page.slotType === 'SPREAD').length
}

export function toMagazinePageSummary(page: CatalogMagazinePage) {
  return {
    id: page.id,
    name: page.name,
    pageType: page.pageType,
    previewImage: page.previewImage,
    isRequired: page.isRequired,
  }
}

export function getJournalPageDisplayName(
  page: { slotType: JournalSlotType; magazinePage: { name: string } },
  spreadIndex?: number,
): string {
  if (page.slotType === 'COVER') {
    return JOURNAL_SLOT_LABELS.COVER
  }

  if (page.slotType === 'BACK_COVER') {
    return JOURNAL_SLOT_LABELS.BACK_COVER
  }

  return `${JOURNAL_SLOT_LABELS.SPREAD} ${spreadIndex ?? ''}`.trim()
}

export function findTemplateById(
  templates: CatalogMagazinePage[],
  id: string,
): CatalogMagazinePage | undefined {
  return templates.find((template) => template.id === id)
}
