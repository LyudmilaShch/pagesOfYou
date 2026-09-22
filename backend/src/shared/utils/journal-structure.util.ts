import {
  JournalSpreadLayout,
  PageType,
  type MagazinePage,
} from '@prisma/client';
import {
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  createDefaultCanvasData,
  createSpreadCanvasData,
  normalizeCanvasData,
  type CanvasData,
} from '../types/canvas-data.types';
import { MIN_JOURNAL_SPREADS } from '../constants/journal.constants';
import { mergePageCanvasesIntoSpread } from './merge-page-canvases.util';

export interface TemplateCatalog {
  cover: MagazinePage[];
  spread: MagazinePage[];
  page: MagazinePage[];
  backCover: MagazinePage[];
  toc: MagazinePage[];
}

export interface DefaultSpreadTemplate {
  layoutMode: JournalSpreadLayout;
  magazinePageId: string;
  rightMagazinePageId: string | null;
}

export function groupTemplatesByPageType(pages: MagazinePage[]): TemplateCatalog {
  return {
    cover: pages.filter((page) => page.pageType === PageType.COVER),
    spread: pages.filter((page) => page.pageType === PageType.SPREAD),
    page: pages.filter((page) => page.pageType === PageType.PAGE),
    backCover: pages.filter((page) => page.pageType === PageType.BACK_COVER),
    toc: pages.filter((page) => page.pageType === PageType.TOC),
  };
}

export function pickDefaultCoverTemplate(catalog: TemplateCatalog): MagazinePage | null {
  return catalog.cover[0] ?? null;
}

export function pickDefaultBackCoverTemplate(catalog: TemplateCatalog): MagazinePage | null {
  return catalog.backCover[0] ?? null;
}

/** Unlike cover/back-cover, a table of contents is optional — a magazine type with none simply
 * never gets a TOC slot (see buildInitialJournalSlots, which skips the pushSlot call entirely
 * rather than letting it fall back to an unrelated template). */
export function pickDefaultTocTemplate(catalog: TemplateCatalog): MagazinePage | null {
  return catalog.toc[0] ?? null;
}

export interface BuildInitialJournalOptions {
  /** See resolveInitialSpreadCount — required, not optional, so a caller can't silently fall back
   * to the print-safety floor instead of what the magazine type is actually priced for. */
  includedSpreads: number;
  configuredSpreads?: DefaultSpreadTemplate[];
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
 * target, not a floor: admin-configured default spreads are reused for their content/templates
 * (see resolveConfiguredSpreadAt below) but a LARGER already-configured count must not inflate
 * this — otherwise lowering includedSpreads on a magazine type that already had more spreads
 * configured would silently keep handing new orders the old, larger count. Only
 * MIN_JOURNAL_SPREADS (the print-safety floor) can raise it above includedSpreads - 1 (- 1 more
 * for TOC).
 */
export function resolveInitialSpreadCount(includedSpreads: number, hasToc = false): number {
  return Math.max(MIN_JOURNAL_SPREADS, includedSpreads - 1 - (hasToc ? 1 : 0));
}

function resolveConfiguredSpreadAt(
  index: number,
  configuredSpreads: DefaultSpreadTemplate[] | undefined,
  spreadDefault: DefaultSpreadTemplate | null,
): DefaultSpreadTemplate | null {
  if (configuredSpreads && configuredSpreads.length > 0) {
    return configuredSpreads[index] ?? configuredSpreads[configuredSpreads.length - 1] ?? null;
  }

  return spreadDefault;
}

function resolveSpreadTemplates(
  config: DefaultSpreadTemplate | null,
  catalog: TemplateCatalog,
  templates: MagazinePage[],
): {
  layoutMode: JournalSpreadLayout | null;
  primary: MagazinePage | null;
  right: MagazinePage | null;
} {
  if (!config) {
    return { layoutMode: null, primary: null, right: null };
  }

  if (config.layoutMode === JournalSpreadLayout.SPLIT_PAGES) {
    const left =
      templates.find((page) => page.id === config.magazinePageId) ?? catalog.page[0] ?? null;
    const right = config.rightMagazinePageId
      ? templates.find((page) => page.id === config.rightMagazinePageId) ?? catalog.page[1] ?? left
      : left;

    return {
      layoutMode: JournalSpreadLayout.SPLIT_PAGES,
      primary: left,
      right,
    };
  }

  const spreadTemplate =
    templates.find((page) => page.id === config.magazinePageId) ?? catalog.spread[0] ?? null;

  return {
    layoutMode: spreadTemplate ? JournalSpreadLayout.SPREAD : null,
    primary: spreadTemplate,
    right: null,
  };
}

export function pickDefaultSpreadTemplate(catalog: TemplateCatalog): DefaultSpreadTemplate | null {
  if (catalog.spread.length > 0) {
    return {
      layoutMode: JournalSpreadLayout.SPREAD,
      magazinePageId: catalog.spread[0].id,
      rightMagazinePageId: null,
    };
  }

  if (catalog.page.length >= 2) {
    return {
      layoutMode: JournalSpreadLayout.SPLIT_PAGES,
      magazinePageId: catalog.page[0].id,
      rightMagazinePageId: catalog.page[1].id,
    };
  }

  if (catalog.page.length === 1) {
    return {
      layoutMode: JournalSpreadLayout.SPLIT_PAGES,
      magazinePageId: catalog.page[0].id,
      rightMagazinePageId: catalog.page[0].id,
    };
  }

  return null;
}

export function buildJournalPageSnapshot(
  slotType: PageType,
  layoutMode: JournalSpreadLayout | null,
  primaryTemplate: MagazinePage | null,
  rightTemplate: MagazinePage | null,
): CanvasData {
  // TOC gets the same full spread-width canvas as a regular spread — a table of contents needs
  // the room, and it's never built from two SPLIT_PAGES halves the way a spread can be (a TOC
  // template is always one single canvas), so `layoutMode` for it is always null.
  const isSpreadShaped = slotType === PageType.SPREAD || slotType === PageType.TOC;

  if (!primaryTemplate) {
    if (isSpreadShaped) {
      return createSpreadCanvasData();
    }

    return createDefaultCanvasData();
  }

  if (isSpreadShaped) {
    const canvas =
      layoutMode === JournalSpreadLayout.SPLIT_PAGES && rightTemplate
        ? mergePageCanvasesIntoSpread(
            normalizeCanvasData(primaryTemplate.canvasData),
            normalizeCanvasData(rightTemplate.canvasData),
          )
        : normalizeCanvasData(primaryTemplate.canvasData);

    return {
      ...canvas,
      pageWidth: A4_SPREAD_PAGE_WIDTH,
      pageHeight: A4_SPREAD_PAGE_HEIGHT,
    };
  }

  return normalizeCanvasData(primaryTemplate.canvasData);
}

export interface JournalSlotDraft {
  slotType: PageType;
  layoutMode: JournalSpreadLayout | null;
  magazinePageId: string;
  rightMagazinePageId: string | null;
  sortOrder: number;
  pageSnapshot: CanvasData;
}

export function buildInitialJournalSlots(
  templates: MagazinePage[],
  options: BuildInitialJournalOptions,
): JournalSlotDraft[] {
  const catalog = groupTemplatesByPageType(templates);
  const coverTemplate = pickDefaultCoverTemplate(catalog);
  const backCoverTemplate = pickDefaultBackCoverTemplate(catalog);
  const tocTemplate = pickDefaultTocTemplate(catalog);
  const spreadDefault = pickDefaultSpreadTemplate(catalog);
  const spreadCount = resolveInitialSpreadCount(options.includedSpreads, Boolean(tocTemplate));

  const slots: JournalSlotDraft[] = [];
  let sortOrder = 0;

  const fallbackTemplateId =
    catalog.spread[0]?.id ??
    catalog.page[0]?.id ??
    coverTemplate?.id ??
    backCoverTemplate?.id ??
    templates[0]?.id;

  const pushSlot = (
    slotType: PageType,
    layoutMode: JournalSpreadLayout | null,
    primary: MagazinePage | null,
    right: MagazinePage | null,
  ): void => {
    const primaryId =
      primary?.id ??
      (slotType === PageType.SPREAD ? spreadDefault?.magazinePageId : null) ??
      fallbackTemplateId;

    if (!primaryId) {
      return;
    }

    slots.push({
      slotType,
      layoutMode,
      magazinePageId: primaryId,
      rightMagazinePageId: right?.id ?? null,
      sortOrder: sortOrder++,
      pageSnapshot: buildJournalPageSnapshot(slotType, layoutMode, primary, right),
    });
  };

  pushSlot(PageType.COVER, null, coverTemplate, null);

  // Optional, and — unlike every other slot type — never falls back to an unrelated template
  // when absent: pushSlot's own fallback chain would otherwise insert a bogus TOC slot built from
  // a random spread/cover template. Guarding the call itself, rather than adding a branch inside
  // pushSlot, keeps "magazine type just doesn't have a TOC" a clean no-op.
  if (tocTemplate) {
    pushSlot(PageType.TOC, null, tocTemplate, null);
  }

  for (let index = 0; index < spreadCount; index += 1) {
    const config = resolveConfiguredSpreadAt(
      index,
      options.configuredSpreads,
      spreadDefault,
    );
    const resolved = resolveSpreadTemplates(config, catalog, templates);

    pushSlot(PageType.SPREAD, resolved.layoutMode, resolved.primary, resolved.right);
  }

  pushSlot(PageType.BACK_COVER, null, backCoverTemplate, null);

  return slots;
}

// A TOC slot spans (and is priced/printed as) a full spread's worth of physical pages exactly
// like a SPREAD slot — it just never lists itself as an entry (see buildTocEntries) — so it counts
// here too. Leaving it out (as this once did) undercounted both pricing and the print-safety floor
// check for any journal that has a table of contents.
export function countSpreadSlots(
  pages: Array<{ slotType: PageType }>,
): number {
  return pages.filter(
    (page) => page.slotType === PageType.SPREAD || page.slotType === PageType.TOC,
  ).length;
}
