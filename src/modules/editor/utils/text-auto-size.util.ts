import {
  MIN_TEXT_BOX_HEIGHT,
  MIN_TEXT_BOX_WIDTH,
} from '../constants/text.constants'
import type { Position, Size } from '../models/geometry.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import { resolveTextContent } from '../adapters/konva/element-node.adapter'
import type { TextMeasureSnapshot } from './text-measure.util'
import { measureTextBox } from './text-measure.util'

export interface TextLayoutInput {
  element: TextPlaceholder
  displayText?: string | null
  pageWidth: number
  /** 'hug' replaces the box with the measured text (a newly created element).
   * 'grow' never shrinks the saved box: width only grows, up to the page edge, and height only
   * grows downward. That is what keeps typing from breathing or snapping the frame. */
  fit?: 'hug' | 'grow'
}

export interface TextLayoutResult {
  size: Size
}

/** How wide a text may become before it wraps: from its left edge to the right edge of the page. */
export function getTextMaxWidth(
  anchorX: number,
  pageWidth: number,
  _pageHeight?: number,
): number {
  return Math.max(MIN_TEXT_BOX_WIDTH, pageWidth - anchorX)
}

export interface LayoutTextBoxInput {
  mode: TextPlaceholder['textSizingMode']
  fit: 'hug' | 'grow'
  current: Size
  anchorX: number
  pageWidth: number
  measure: TextMeasureSnapshot
}

/**
 * The box around a text, from a single measurement.
 * Auto width grows with the line until the page edge, then the width stays at that edge and the
 * text wraps. It does not shrink back when characters are deleted — shrinking is what made the
 * frame breathe and snap between "one long line" and "full page width".
 * Fixed width (the user dragged a side handle or typed W) never changes here.
 * Height follows the wrapped block and, in 'grow', never gets shorter than the box already saved.
 * Position is not this function's job: the top-left stays put (see `positionForTopLeftAnchor`).
 */
export function layoutTextBox(input: LayoutTextBoxInput): Size {
  const available = getTextMaxWidth(input.anchorX, input.pageWidth)
  const singleLineWidth = Math.max(
    MIN_TEXT_BOX_WIDTH,
    Math.ceil(input.measure.naturalWidth),
  )

  let width: number
  if (input.mode === 'fixed') {
    width = Math.max(MIN_TEXT_BOX_WIDTH, input.current.width)
  } else if (input.fit === 'hug') {
    width = Math.min(singleLineWidth, available)
  } else {
    const grown = Math.max(
      input.current.width,
      Math.min(singleLineWidth, available),
    )
    width = singleLineWidth > available ? available : grown
  }

  width = Math.round(width)

  const contentHeight = Math.max(
    MIN_TEXT_BOX_HEIGHT,
    Math.ceil(
      singleLineWidth <= width
        ? input.measure.naturalHeight
        : input.measure.heightAtWidth(width),
    ),
  )

  const height =
    input.fit === 'hug'
      ? contentHeight
      : Math.max(Math.round(input.current.height), contentHeight)

  return { width, height: Math.round(height) }
}

export function computeTextBoxLayout(input: TextLayoutInput): TextLayoutResult {
  const text = resolveTextContent(input.element, input.displayText)
  const fit = input.fit ?? 'grow'

  return {
    size: layoutTextBox({
      mode: input.element.textSizingMode,
      fit,
      current: input.element.size,
      anchorX: input.element.position.x,
      pageWidth: input.pageWidth,
      measure: measureTextBox(input.element, text),
    }),
  }
}

/**
 * Keeps the element's local top-left corner on the same page point when the box size changes.
 * Rotation is around the box center, so a taller box would swing that corner unless the stored
 * top-left shifts by the same amount. With no rotation the shift is zero — x/y stay as they are.
 */
export function positionForTopLeftAnchor(
  position: Position,
  oldSize: Size,
  newSize: Size,
  rotationDeg: number,
): Position {
  if (
    !rotationDeg ||
    (oldSize.width === newSize.width && oldSize.height === newSize.height)
  ) {
    return position
  }

  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rotate = (x: number, y: number) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  })

  const oldOffset = rotate(-oldSize.width / 2, -oldSize.height / 2)
  const newOffset = rotate(-newSize.width / 2, -newSize.height / 2)

  return {
    x: Math.round(
      position.x +
        (oldSize.width - newSize.width) / 2 +
        oldOffset.x -
        newOffset.x,
    ),
    y: Math.round(
      position.y +
        (oldSize.height - newSize.height) / 2 +
        oldOffset.y -
        newOffset.y,
    ),
  }
}
