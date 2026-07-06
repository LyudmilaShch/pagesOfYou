import type { PageElement } from '../models'
import type {
  TextPlaceholder,
  TextSizingMode,
  TextTransform,
  TextVerticalAlign,
} from '../models/text-placeholder.model'
import { TEXT_FONT_SIZE_DEFAULT, TEXT_SIZING_MODE_DEFAULT } from '../constants/text.constants'

export const TEXT_VERTICAL_ALIGN_DEFAULT: TextVerticalAlign = 'top'
export const TEXT_TRANSFORM_DEFAULT: TextTransform = 'none'

const TEXT_TYPES = new Set([
  'text-placeholder',
  'title-placeholder',
  'subtitle-placeholder',
])

function isTextSizingMode(value: unknown): value is TextSizingMode {
  return value === 'auto' || value === 'fixed'
}

function isTextVerticalAlign(value: unknown): value is TextVerticalAlign {
  return value === 'top' || value === 'middle' || value === 'bottom'
}

function isTextTransform(value: unknown): value is TextTransform {
  return value === 'none' || value === 'uppercase'
}

export function isTextPlaceholderType(type: string): boolean {
  return TEXT_TYPES.has(type)
}

function isTextPlaceholderElement(element: PageElement): element is TextPlaceholder {
  return isTextPlaceholderType(element.type)
}

export function normalizeTextPlaceholderElement(element: PageElement): PageElement {
  if (!isTextPlaceholderElement(element)) {
    return element
  }

  const normalized: TextPlaceholder = {
    ...element,
    type: element.type,
    rotation: 0,
    fontSize:
      typeof element.fontSize === 'number' && element.fontSize > 0
        ? element.fontSize
        : TEXT_FONT_SIZE_DEFAULT,
    lineHeight:
      typeof element.lineHeight === 'number' && element.lineHeight > 0 ? element.lineHeight : 1.4,
    letterSpacing: typeof element.letterSpacing === 'number' ? element.letterSpacing : 0,
    fontWeight: typeof element.fontWeight === 'number' ? element.fontWeight : 400,
    fontItalic: Boolean(element.fontItalic),
    verticalAlign: isTextVerticalAlign(element.verticalAlign)
      ? element.verticalAlign
      : TEXT_VERTICAL_ALIGN_DEFAULT,
    textTransform: isTextTransform(element.textTransform)
      ? element.textTransform
      : TEXT_TRANSFORM_DEFAULT,
    textSizingMode: isTextSizingMode(element.textSizingMode)
      ? element.textSizingMode
      : TEXT_SIZING_MODE_DEFAULT,
  }

  return normalized
}
