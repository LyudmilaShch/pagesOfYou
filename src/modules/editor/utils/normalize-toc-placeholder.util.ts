import type { PageElement } from '../models'
import type { TocPlaceholder } from '../models/toc-placeholder.model'
import type { TextTransform, TextVerticalAlign } from '../models/text-placeholder.model'
import type { TextEffect, TextEffectType } from '../models/text-effect.model'
import { TEXT_FONT_SIZE_DEFAULT } from '../constants/text.constants'
import {
  TEXT_TRANSFORM_DEFAULT,
  TEXT_VERTICAL_ALIGN_DEFAULT,
} from './normalize-text-placeholder.util'

const TEXT_EFFECT_TYPES = new Set<TextEffectType>([
  'drop-shadow',
  'glow',
  'echo',
  'outlined',
  'background',
  'stroke',
  'neon',
])

function isTextEffect(value: unknown): value is TextEffect | null {
  if (value === null) {
    return true
  }
  if (typeof value !== 'object') {
    return false
  }
  const candidate = value as { type?: unknown; params?: unknown }
  return (
    typeof candidate.type === 'string' &&
    TEXT_EFFECT_TYPES.has(candidate.type as TextEffectType) &&
    typeof candidate.params === 'object' &&
    candidate.params !== null
  )
}

function isTextVerticalAlign(value: unknown): value is TextVerticalAlign {
  return value === 'top' || value === 'middle' || value === 'bottom'
}

function isTextTransform(value: unknown): value is TextTransform {
  return value === 'none' || value === 'uppercase'
}

export function isTocPlaceholderElement(element: PageElement): element is TocPlaceholder {
  return element.type === 'toc-placeholder'
}

export function normalizeTocPlaceholderElement(element: PageElement): PageElement {
  if (!isTocPlaceholderElement(element)) {
    return element
  }

  const normalized: TocPlaceholder = {
    ...element,
    type: element.type,
    label: typeof element.label === 'string' && element.label.trim() ? element.label : 'Содержание',
    rotation:
      typeof element.rotation === 'number' && Number.isFinite(element.rotation) ? element.rotation : 0,
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
    effect: isTextEffect(element.effect) ? element.effect : null,
    entryGap:
      typeof element.entryGap === 'number' && element.entryGap >= 0 ? element.entryGap : 12,
    dotLeader: typeof element.dotLeader === 'boolean' ? element.dotLeader : true,
  }

  return normalized
}
