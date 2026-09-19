import type { PageElement } from '../models'
import type {
  AiTextPlaceholder,
  LengthConstraint,
  LengthConstraintUnit,
} from '../models/ai-text-placeholder.model'
import type { TextSizingMode, TextTransform, TextVerticalAlign } from '../models/text-placeholder.model'
import type { TextEffect, TextEffectType } from '../models/text-effect.model'
import { TEXT_FONT_SIZE_DEFAULT, TEXT_SIZING_MODE_DEFAULT } from '../constants/text.constants'
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

function isTextSizingMode(value: unknown): value is TextSizingMode {
  return value === 'auto' || value === 'fixed'
}

function isTextVerticalAlign(value: unknown): value is TextVerticalAlign {
  return value === 'top' || value === 'middle' || value === 'bottom'
}

function isTextTransform(value: unknown): value is TextTransform {
  return value === 'none' || value === 'uppercase'
}

function isLengthConstraintUnit(value: unknown): value is LengthConstraintUnit {
  return value === 'characters' || value === 'words'
}

function normalizeLengthBound(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeLengthConstraint(value: unknown): LengthConstraint {
  const candidate = (value && typeof value === 'object' ? value : {}) as Partial<LengthConstraint>
  return {
    unit: isLengthConstraintUnit(candidate.unit) ? candidate.unit : 'characters',
    min: normalizeLengthBound(candidate.min),
    max: normalizeLengthBound(candidate.max),
  }
}

export function isAiTextPlaceholderElement(element: PageElement): element is AiTextPlaceholder {
  return element.type === 'ai-text-placeholder'
}

export function normalizeAiTextPlaceholderElement(element: PageElement): PageElement {
  if (!isAiTextPlaceholderElement(element)) {
    return element
  }

  const normalized: AiTextPlaceholder = {
    ...element,
    type: element.type,
    label: typeof element.label === 'string' && element.label.trim() ? element.label : 'AI-текст',
    prompt: typeof element.prompt === 'string' ? element.prompt : '',
    questionKeys: Array.isArray(element.questionKeys)
      ? element.questionKeys.filter((key): key is string => typeof key === 'string')
      : [],
    lengthConstraint: normalizeLengthConstraint(element.lengthConstraint),
    rotation:
      typeof element.rotation === 'number' && Number.isFinite(element.rotation)
        ? element.rotation
        : 0,
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
    effect: isTextEffect(element.effect) ? element.effect : null,
  }

  return normalized
}
