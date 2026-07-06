import type { PageElement } from './index'
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '../constants/page.constants'
import { normalizePhotoPlaceholderElement } from '../utils/normalize-photo-placeholder.util'
import { normalizeTextPlaceholderElement } from '../utils/normalize-text-placeholder.util'

export const CANVAS_DATA_VERSION = 1 as const

export interface CanvasData {
  version: typeof CANVAS_DATA_VERSION
  pageWidth?: number
  pageHeight?: number
  backgroundColor?: string
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
    elements: [],
  }
}

export function normalizeCanvasData(raw: unknown): CanvasData {
  if (!raw || typeof raw !== 'object') {
    return createEmptyCanvasData()
  }

  const data = raw as Partial<CanvasData>

  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: typeof data.pageWidth === 'number' ? data.pageWidth : A4_PAGE_WIDTH,
    pageHeight: typeof data.pageHeight === 'number' ? data.pageHeight : A4_PAGE_HEIGHT,
    backgroundColor:
      typeof data.backgroundColor === 'string' ? data.backgroundColor : '#FFFFFF',
    elements: Array.isArray(data.elements)
      ? (data.elements as PageElement[]).map((element) =>
          normalizePhotoPlaceholderElement(normalizeTextPlaceholderElement(element)),
        )
      : [],
  }
}
