import type { PageElement } from './index'
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '../constants/page.constants'
import { normalizePhotoPlaceholderElement } from '../utils/normalize-photo-placeholder.util'
import { normalizeTextPlaceholderElement } from '../utils/normalize-text-placeholder.util'
import {
  getPageBackgroundCropState,
  normalizePageBackgroundImageFit,
  normalizePageBackgroundSettings,
  normalizeSpreadBackgroundMode,
  type PageBackgroundSettings,
  type SpreadBackgroundMode,
} from './page-background.model'
import { migrateLegacyBackgroundElements } from '../utils/migrate-legacy-background.util'
import { isSpreadCanvas } from '../utils/spread.util'

export const CANVAS_DATA_VERSION = 1 as const

export interface CanvasData {
  version: typeof CANVAS_DATA_VERSION
  pageWidth?: number
  pageHeight?: number
  backgroundColor?: string
  backgroundImageUrl?: string | null
  backgroundImageFit?: 'cover' | 'fill'
  backgroundImageCropX?: number
  backgroundImageCropY?: number
  backgroundImageScale?: number
  spreadBackgroundMode?: SpreadBackgroundMode
  leftPageBackground?: Partial<PageBackgroundSettings>
  rightPageBackground?: Partial<PageBackgroundSettings>
  elements: PageElement[]
}

export function createEmptyCanvasData(): CanvasData {
  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_PAGE_WIDTH,
    pageHeight: A4_PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    elements: [],
  }
}

export function createSpreadCanvasData(): CanvasData {
  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    spreadBackgroundMode: 'spread',
    elements: [],
  }
}

export function normalizeCanvasData(raw: unknown): CanvasData {
  if (!raw || typeof raw !== 'object') {
    return createEmptyCanvasData()
  }

  const data = raw as Partial<CanvasData>
  const rawElements = Array.isArray(data.elements) ? (data.elements as PageElement[]) : []
  const migrated = migrateLegacyBackgroundElements(rawElements, data.backgroundColor)
  const backgroundCrop = getPageBackgroundCropState({
    cropX: data.backgroundImageCropX,
    cropY: data.backgroundImageCropY,
    imageScale: data.backgroundImageScale,
  })
  const pageWidth = typeof data.pageWidth === 'number' ? data.pageWidth : A4_PAGE_WIDTH
  const pageHeight = typeof data.pageHeight === 'number' ? data.pageHeight : A4_PAGE_HEIGHT
  const spread = isSpreadCanvas(pageWidth, pageHeight)
  const rootBackground = normalizePageBackgroundSettings({
    backgroundColor:
      typeof migrated.backgroundColor === 'string' ? migrated.backgroundColor : '#FFFFFF',
    backgroundImageUrl:
      typeof data.backgroundImageUrl === 'string'
        ? data.backgroundImageUrl
        : data.backgroundImageUrl === null
          ? null
          : undefined,
    backgroundImageFit: normalizePageBackgroundImageFit(data.backgroundImageFit),
    backgroundImageCropX: backgroundCrop.cropX,
    backgroundImageCropY: backgroundCrop.cropY,
    backgroundImageScale: backgroundCrop.imageScale,
  })
  const spreadBackgroundMode = spread
    ? normalizeSpreadBackgroundMode(data.spreadBackgroundMode)
    : undefined

  const normalized: CanvasData = {
    version: CANVAS_DATA_VERSION,
    pageWidth,
    pageHeight,
    backgroundColor: rootBackground.backgroundColor,
    backgroundImageUrl: rootBackground.backgroundImageUrl,
    backgroundImageFit: rootBackground.backgroundImageFit,
    backgroundImageCropX: rootBackground.backgroundImageCropX,
    backgroundImageCropY: rootBackground.backgroundImageCropY,
    backgroundImageScale: rootBackground.backgroundImageScale,
    elements: migrated.elements.map((element) =>
      normalizePhotoPlaceholderElement(normalizeTextPlaceholderElement(element)),
    ),
  }

  if (spread) {
    normalized.spreadBackgroundMode = spreadBackgroundMode ?? 'spread'

    if (normalized.spreadBackgroundMode === 'per-page') {
      normalized.leftPageBackground = normalizePageBackgroundSettings(
        data.leftPageBackground,
        rootBackground,
      )
      normalized.rightPageBackground = normalizePageBackgroundSettings(
        data.rightPageBackground,
        rootBackground,
      )
    }
  }

  return normalized
}
