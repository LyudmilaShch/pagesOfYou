import type { PageElement } from '../models'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import type { ElementPatch } from '../store/editor.store'
import { isTextPlaceholderType } from './normalize-text-placeholder.util'
import {
  computeTextBoxLayout,
  type TextLayoutResult,
} from './text-auto-size.util'

/** Fields that change how the glyphs wrap. `verticalAlign` is not here: it only moves lines
 * inside the existing frame. `size` is not here either — width and height are applied by the
 * caller, so a height edit cannot loop back into a measurement that moves the box. */
export const TEXT_LAYOUT_PATCH_KEYS = new Set([
  'defaultText',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontItalic',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textSizingMode',
])

export function shouldRecalculateTextLayout(
  patch: ElementPatch,
  element: PageElement,
): boolean {
  if (!isTextPlaceholderType(element.type)) {
    return false
  }

  return Object.keys(patch).some((key) => TEXT_LAYOUT_PATCH_KEYS.has(key))
}

export interface RecalculateTextLayoutInput {
  element: TextPlaceholder
  displayText?: string | null
  pageWidth: number
  fit?: 'hug' | 'grow'
}

export function recalculateTextLayout(
  input: RecalculateTextLayoutInput,
): TextLayoutResult {
  return computeTextBoxLayout({
    element: input.element,
    displayText: input.displayText,
    pageWidth: input.pageWidth,
    fit: input.fit ?? 'grow',
  })
}

export function applyTextContentChange(
  updateElement: (id: string, patch: ElementPatch) => void,
  elementId: string,
  value: string,
): void {
  updateElement(elementId, { defaultText: value })
}

export function resolveTextEditingDraft(
  element: TextPlaceholder,
  resolveValue?: (elementId: string) => string,
): string {
  if (resolveValue) {
    return resolveValue(element.id)
  }

  return element.defaultText ?? element.label ?? ''
}
