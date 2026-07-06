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
  };
}

export function pickDefaultCoverTemplate(catalog: TemplateCatalog): MagazinePage | null {
  return catalog.cover[0] ?? null;
}

export function pickDefaultBackCoverTemplate(catalog: TemplateCatalog): MagazinePage | null {
  return catalog.backCover[0] ?? null;
}

export interface BuildInitialJournalOptions {
  configuredSpreads?: DefaultSpreadTemplate[];
}

export function resolveInitialSpreadCount(
  configuredSpreads?: DefaultSpreadTemplate[],
): number {
  return Math.max(MIN_JOURNAL_SPREADS, configuredSpreads?.length ?? MIN_JOURNAL_SPREADS);
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
  if (!primaryTemplate) {
    if (slotType === PageType.SPREAD) {
      return createSpreadCanvasData();
    }

    return createDefaultCanvasData();
  }

  if (slotType === PageType.SPREAD) {
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
  options: BuildInitialJournalOptions = {},
): JournalSlotDraft[] {
  const catalog = groupTemplatesByPageType(templates);
  const coverTemplate = pickDefaultCoverTemplate(catalog);
  const backCoverTemplate = pickDefaultBackCoverTemplate(catalog);
  const spreadDefault = pickDefaultSpreadTemplate(catalog);
  const spreadCount = resolveInitialSpreadCount(options.configuredSpreads);

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

export function countSpreadSlots(
  pages: Array<{ slotType: PageType }>,
): number {
  return pages.filter((page) => page.slotType === PageType.SPREAD).length;
}
