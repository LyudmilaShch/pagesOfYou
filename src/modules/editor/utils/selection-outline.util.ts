import type { GroupElement, PageElement } from '../models'
import type { AiTextPlaceholder } from '../models/ai-text-placeholder.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import { buildAiTextElementPreview } from './ai-text-preview.util'
import { shapeLineLocalBounds } from './element-bounds.util'
import { getTextInkRect, type TextInkRect } from './text-measure.util'

function isGroup(element: PageElement): element is GroupElement {
  return element.type === 'group'
}

function isList(element: PageElement): boolean {
  return Boolean(element.listId && element.list)
}

function isText(element: PageElement): element is TextPlaceholder {
  return (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  )
}

export interface SelectionOutlineRect {
  x: number
  y: number
  width: number
  height: number
}

export type TextInkMeasure = (element: TextPlaceholder) => TextInkRect

function displayedText(element: TextPlaceholder): string {
  const raw = element.defaultText?.trim() || element.label?.trim() || ''
  return element.textTransform === 'uppercase' ? raw.toUpperCase() : raw
}

function isAiText(element: PageElement): element is AiTextPlaceholder {
  return element.type === 'ai-text-placeholder'
}

/** Same string the canvas paints. AI text keeps a short frame and draws the preview below it. */
function paintedText(element: PageElement): { element: TextPlaceholder; text: string } | null {
  if (isText(element)) {
    const text = displayedText(element)
    return text ? { element, text } : null
  }

  if (!isAiText(element)) {
    return null
  }

  const raw = element.previewPlaceholderText?.trim() || buildAiTextElementPreview(element)
  const text = element.textTransform === 'uppercase' ? raw.toUpperCase() : raw
  if (!text) {
    return null
  }

  return { element: element as unknown as TextPlaceholder, text }
}

function unionRects(a: SelectionOutlineRect, b: SelectionOutlineRect): SelectionOutlineRect {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  }
}

function defaultTextInk(element: TextPlaceholder): TextInkRect {
  return getTextInkRect(element, displayedText(element))
}

function unionOf(rects: SelectionOutlineRect[]): SelectionOutlineRect | null {
  if (rects.length === 0) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
}

function childVisualRect(
  child: PageElement,
  measureTextInk: TextInkMeasure,
): SelectionOutlineRect | null {
  if (child.visible === false) {
    return null
  }

  if (isText(child)) {
    const ink = measureTextInk(child)
    if (ink.width <= 0 || ink.height <= 0) {
      return null
    }
    return {
      x: child.position.x + ink.x,
      y: child.position.y + ink.y,
      width: ink.width,
      height: ink.height,
    }
  }

  if (isGroup(child)) {
    const inner = selectionOutlineBounds(child, measureTextInk)
    return {
      x: child.position.x + inner.x,
      y: child.position.y + inner.y,
      width: inner.width,
      height: inner.height,
    }
  }

  if (child.type === 'shape-line') {
    const line = shapeLineLocalBounds(child)
    return {
      x: child.position.x + line.x,
      y: child.position.y + line.y,
      width: line.width,
      height: line.height,
    }
  }

  return {
    x: child.position.x,
    y: child.position.y,
    width: child.size.width,
    height: child.size.height,
  }
}

/**
 * Dashed selection frame. A list row keeps the box it was created with while the title and
 * the page number move, and a right-aligned number wider than its frame paints to the left of
 * that box. The dash follows the letters. Other groups keep their stored frame unless something
 * sticks out of it.
 */
export function selectionOutlineBounds(
  element: PageElement,
  measureTextInk: TextInkMeasure = defaultTextInk,
): SelectionOutlineRect {
  if (element.type === 'shape-line') {
    return {
      x: 0,
      y: -8,
      width: Math.max(element.size.width, 1),
      height: 16,
    }
  }

  const stored: SelectionOutlineRect = {
    x: 0,
    y: 0,
    width: element.size.width,
    height: Math.max(element.size.height, 1),
  }

  if (!isGroup(element)) {
    return stored
  }

  const visual = unionOf(
    element.children
      .map((child) => childVisualRect(child, measureTextInk))
      .filter((rect): rect is SelectionOutlineRect => rect != null),
  )
  if (!visual) {
    return stored
  }

  if (isList(element)) {
    return visual
  }

  const sticksOut =
    visual.x < -0.5 ||
    visual.y < -0.5 ||
    visual.x + visual.width > element.size.width + 0.5 ||
    visual.y + visual.height > element.size.height + 0.5

  return sticksOut ? visual : stored
}

/**
 * Box used by align-to-frame. The stored frame is included, and so is text that paints outside
 * it. AI text does that on purpose: the preview keeps going below the frame, and pinning only
 * the frame to the bottom edge sends those lines off the page.
 */
export function alignmentLocalBounds(
  element: PageElement,
  measureTextInk: TextInkMeasure = defaultTextInk,
): SelectionOutlineRect {
  const stored = selectionOutlineBounds(element, measureTextInk)
  if (isGroup(element) || element.type === 'shape-line') {
    return stored
  }

  const painted = paintedText(element)
  if (!painted) {
    return stored
  }

  const ink = measureTextInk === defaultTextInk
    ? getTextInkRect(painted.element, painted.text)
    : measureTextInk(painted.element)
  if (ink.width <= 0 || ink.height <= 0) {
    return stored
  }

  return unionRects(stored, ink)
}
