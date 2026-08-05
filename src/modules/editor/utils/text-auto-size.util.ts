import {
  MIN_TEXT_BOX_HEIGHT,
  MIN_TEXT_BOX_WIDTH,
  TEXT_BOX_PADDING,
} from '../constants/text.constants'
import type { Position, Size } from '../models/geometry.model'
import type { PageElement } from '../models'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import {
  resolveTextContent,
} from '../adapters/konva/element-node.adapter'
import { isTextPlaceholderType } from './normalize-text-placeholder.util'
import {
  measureKonvaText,
  measureTextLineWidthWithBuffer,
} from './text-measure.util'

export interface TextLayoutInput {
  element: TextPlaceholder
  displayText?: string | null
  pageWidth: number
  pageHeight: number
  adjustAnchor?: boolean
}

export interface TextLayoutResult {
  size: Size
  position?: Partial<Position>
}

export function getTextMaxWidth(
  anchorX: number,
  pageWidth: number,
  _pageHeight?: number,
): number {
  return Math.max(MIN_TEXT_BOX_WIDTH, pageWidth - anchorX)
}

function getAvailableWidth(
  element: TextPlaceholder,
  pageWidth: number,
  pageHeight: number,
): number {
  return getTextMaxWidth(element.position.x, pageWidth, pageHeight)
}

function adjustPositionForSizeChange(
  element: TextPlaceholder,
  oldSize: Size,
  newSize: Size,
): Partial<Position> | undefined {
  const patch: Partial<Position> = {}

  if (newSize.width !== oldSize.width && element.textSizingMode === 'auto') {
    const deltaWidth = newSize.width - oldSize.width

    if (element.textAlign === 'center') {
      patch.x = element.position.x - deltaWidth / 2
    } else if (element.textAlign === 'right') {
      patch.x = element.position.x - deltaWidth
    }
  }

  if (newSize.height !== oldSize.height) {
    const deltaHeight = newSize.height - oldSize.height

    if (element.verticalAlign === 'middle') {
      patch.y = element.position.y - deltaHeight / 2
    } else if (element.verticalAlign === 'bottom') {
      patch.y = element.position.y - deltaHeight
    }
  }

  return Object.keys(patch).length > 0 ? patch : undefined
}

export function computeTextBoxLayout(input: TextLayoutInput): TextLayoutResult {
  const { element, pageWidth, adjustAnchor = false } = input
  const text = resolveTextContent(element, input.displayText)
  const padding = TEXT_BOX_PADDING * 2
  const availableWidth = getAvailableWidth(element, pageWidth, input.pageHeight)
  const oldSize = { ...element.size }

  if (element.textSizingMode === 'fixed') {
    // Fixed mode: the box WIDTH is user-set and must never change here — only height (from
    // re-wrapping) does. `wrapWidth` is the CONTENT area (box width minus padding), matching what
    // getTextConfig actually feeds Konva.Text as its wrap width; measuring against the full box
    // width instead (as this used to) made lines wrap slightly wider than they're actually
    // rendered. The previous version also fed that box-sized `wrapWidth` back through the shared
    // `ceil(contentWidth + padding + 2)` formula below — meant for converting a *content*
    // measurement into a box size — which re-added padding on every recalculation, growing the box
    // by ~10 units each time it was called (e.g. on every element move, since drag-end
    // unconditionally recalculates text size).
    const boxWidth = Math.max(MIN_TEXT_BOX_WIDTH, Math.min(element.size.width, availableWidth))
    const wrapWidth = Math.max(1, boxWidth - padding)
    const measured = measureKonvaText({
      text,
      element,
      maxWidth: wrapWidth,
    })

    return {
      size: {
        width: boxWidth,
        height: Math.max(MIN_TEXT_BOX_HEIGHT, Math.ceil(measured.textHeight + padding + 2)),
      },
    }
  }

  let contentWidth: number
  let contentHeight: number

  const singleLineWidth = measureTextLineWidthWithBuffer(text, element)
  const maxContentWidth = Math.max(MIN_TEXT_BOX_WIDTH, availableWidth - padding)

  if (singleLineWidth <= maxContentWidth) {
    contentWidth = singleLineWidth
    contentHeight = measureKonvaText({ text, element }).textHeight
  } else {
    contentWidth = maxContentWidth
    const wrapped = measureKonvaText({
      text,
      element,
      maxWidth: contentWidth,
    })
    contentHeight = wrapped.textHeight
  }

  const size: Size = {
    width: Math.max(MIN_TEXT_BOX_WIDTH, Math.ceil(contentWidth + padding + 2)),
    height: Math.max(MIN_TEXT_BOX_HEIGHT, Math.ceil(contentHeight + padding + 2)),
  }

  if (!adjustAnchor) {
    return { size }
  }

  const position = adjustPositionForSizeChange(element, oldSize, size)

  return { size, position }
}

export function applyTextLayoutToElement(
  element: PageElement,
  displayText: string | null | undefined,
  pageWidth: number,
  pageHeight: number,
): PageElement {
  if (!isTextPlaceholderType(element.type)) {
    return element
  }

  const layout = computeTextBoxLayout({
    element: element as TextPlaceholder,
    displayText,
    pageWidth,
    pageHeight,
    adjustAnchor: false,
  })

  return {
    ...element,
    size: layout.size,
  }
}
