import {
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import { getRootPageBackgroundSettings } from '@/modules/editor/utils/spread-background.util'
import {
  CANVAS_DATA_VERSION,
  createEmptyCanvasData,
  createSpreadCanvasData,
  normalizeCanvasData,
  type CanvasData,
} from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import type { TocEntry } from '@/modules/editor/models/toc-placeholder.model'
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
  toc: CatalogMagazinePage[]
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

  // Each side keeps its OWN source page's background — flattening them into one shared value
  // (the old behavior: `leftCanvas.X ?? rightCanvas.X`) meant whichever page happened to have one
  // set "won" and then bled across BOTH halves once rendered, since nothing downstream knew to
  // treat it as per-page. The root fields below just mirror the left page's, as a harmless
  // fallback for any reader that doesn't know about per-page mode.
  const leftBackground = getRootPageBackgroundSettings(leftCanvas)
  const rightBackground = getRootPageBackgroundSettings(rightCanvas)

  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    ...leftBackground,
    spreadBackgroundMode: 'per-page',
    leftPageBackground: leftBackground,
    rightPageBackground: rightBackground,
    elements: [...leftElements, ...rightElements],
  }
}

export function groupTemplatesByPageType(pages: CatalogMagazinePage[]): TemplateCatalog {
  return {
    cover: pages.filter((page) => page.pageType === 'COVER'),
    spread: pages.filter((page) => page.pageType === 'SPREAD'),
    page: pages.filter((page) => page.pageType === 'PAGE'),
    backCover: pages.filter((page) => page.pageType === 'BACK_COVER'),
    toc: pages.filter((page) => page.pageType === 'TOC'),
  }
}

export interface BuildInitialJournalOptions {
  /** See resolveInitialSpreadCount — required, not optional, so a caller can't silently fall back
   * to the print-safety floor instead of what the magazine type is actually priced for. */
  includedSpreads: number
  configuredSpreads?: DefaultSpreadTemplate[]
}

/**
 * The interior spread count a brand-new journal should start with. `includedSpreads` is priced in
 * "spread-equivalents including the cover" units (cover+back-cover together count as 1 — see
 * pricing.util.ts's COVER_SPREAD_EQUIVALENT), so a customer's default journal should have
 * `includedSpreads - 1` interior spreads to actually match what the base price already covers.
 * A TOC slot (see buildInitialJournalSlots, which inserts it right after the cover when the
 * magazine type has a TOC template configured) spans a full spread's worth of physical pages
 * exactly like an interior spread does (see countSpreadSlots), so it eats one more of that budget
 * — `hasToc` subtracts it here too, otherwise every new journal for a TOC-enabled magazine type
 * would default to one spread more than `includedSpreads` actually covers. This is a strict
 * target, not a floor: admin-configured default spreads (see MagazineTypeDefaultSpreadsTab.vue)
 * are reused for their content/templates (see resolveConfiguredSpreadAt below) but a LARGER
 * already-configured count must not inflate this — otherwise lowering includedSpreads on a
 * magazine type that already had more spreads configured would silently keep handing new orders
 * the old, larger count. Only MIN_JOURNAL_SPREADS (the print-safety floor) can raise it above
 * includedSpreads - 1 (- 1 more for TOC).
 */
export function resolveInitialSpreadCount(includedSpreads: number, hasToc = false): number {
  return Math.max(MIN_JOURNAL_SPREADS, includedSpreads - 1 - (hasToc ? 1 : 0))
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
  // TOC gets the same full spread-width canvas as a regular spread — it always needs the room,
  // and (unlike a spread) is never built from two SPLIT_PAGES halves, so layoutMode for it is
  // always null.
  const isSpreadShaped = slotType === 'SPREAD' || slotType === 'TOC'

  if (!primaryTemplate) {
    return isSpreadShaped ? createSpreadCanvasData() : createEmptyCanvasData()
  }

  if (isSpreadShaped) {
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
  options: BuildInitialJournalOptions,
): LocalJournalSlotDraft[] {
  const catalog = groupTemplatesByPageType(templates)
  const coverTemplate = catalog.cover[0] ?? null
  const backCoverTemplate = catalog.backCover[0] ?? null
  const tocTemplate = catalog.toc[0] ?? null
  const spreadDefault = pickDefaultSpreadTemplate(catalog)
  const spreadCount = resolveInitialSpreadCount(options.includedSpreads, Boolean(tocTemplate))

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

  // Optional, and — unlike every other slot — never falls back to an unrelated template when
  // absent: pushSlot's own fallback chain would otherwise build a bogus TOC slot from a random
  // spread/cover template. Guarding the call itself keeps "no TOC configured" a clean no-op.
  if (tocTemplate) {
    pushSlot('TOC', null, tocTemplate, null)
  }

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

// A TOC slot spans (and is priced/printed as) a full spread's worth of physical pages exactly
// like a SPREAD slot — it just never lists itself as an entry (see buildTocEntries below) — so it
// counts here too. Leaving it out (as this once did) undercounted both pricing and the print-safety
// floor check for any journal that has a table of contents.
export function countSpreadSlots(pages: Array<{ slotType: JournalSlotType }>): number {
  return pages.filter((page) => page.slotType === 'SPREAD' || page.slotType === 'TOC').length
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

  if (page.slotType === 'TOC') {
    return JOURNAL_SLOT_LABELS.TOC
  }

  return `${JOURNAL_SLOT_LABELS.SPREAD} ${spreadIndex ?? ''}`.trim()
}

/**
 * Table-of-contents entries for a finished order — computed here rather than stored, since the
 * same magazine-type template can back orders with different final spread counts (spreads added,
 * reordered, or swapped per order), so real page numbers only ever exist per order, not per
 * template. COVER/BACK_COVER are never numbered or listed (same convention as
 * getJournalPageDisplayName/countSpreadSlots, which already exclude them). SPREAD slots get a
 * listed entry; the TOC slot itself still spans (and numbers) 2 physical pages like a spread, it
 * just never lists itself. Each spread spans 2 physical pages, but the listed number is just
 * where it starts (the left-hand page), not a range — that's the page the reader actually turns
 * to. `excludePageId` is a defensive extra on top of the TOC-slot exclusion above, for the
 * (currently impossible) case of a toc-placeholder ending up on a non-TOC page.
 */
export function buildTocEntries(
  pages: Array<{ id: string; slotType: JournalSlotType; magazinePage: { name: string } }>,
  excludePageId?: string | null,
): TocEntry[] {
  const entries: TocEntry[] = []
  let nextPageNumber = 1

  for (const page of pages) {
    if (page.slotType !== 'SPREAD' && page.slotType !== 'TOC') {
      continue
    }

    const start = nextPageNumber
    nextPageNumber = start + 2

    if (page.slotType !== 'SPREAD' || page.id === excludePageId) {
      continue
    }

    entries.push({
      pageId: page.id,
      title: page.magazinePage.name,
      pageLabel: String(start),
    })
  }

  return entries
}

export function findTemplateById(
  templates: CatalogMagazinePage[],
  id: string,
): CatalogMagazinePage | undefined {
  return templates.find((template) => template.id === id)
}
