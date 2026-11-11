import Konva from 'konva'

import type { TextPlaceholder } from '../models/text-placeholder.model'
import { resolveKonvaFontStyle } from './text-style.util'

export interface TextMeasureInput {
  text: string
  element: TextPlaceholder
  maxWidth?: number
}

export interface TextMeasureResult {
  textWidth: number
  textHeight: number
}

/** One Konva measurement of a string. Width is the longest line; height is the wrapped block.
 * Callers that pass `maxWidth` wrap by words at that exact width — the same width the canvas
 * node is given — so the box and the glyphs cannot disagree. */
export function measureKonvaText(input: TextMeasureInput): TextMeasureResult {
  const content = input.text.length > 0 ? input.text : ' '

  const node = new Konva.Text({
    text: content,
    fontFamily: input.element.fontFamily,
    fontSize: input.element.fontSize,
    fontStyle: resolveKonvaFontStyle(input.element),
    lineHeight: input.element.lineHeight,
    letterSpacing: input.element.letterSpacing,
    align: input.element.textAlign,
    wrap: input.maxWidth != null ? 'word' : 'none',
    width: input.maxWidth,
  })

  const textWidth =
    input.maxWidth != null ? input.maxWidth : Math.max(node.getTextWidth(), 1)
  // Do not read `textHeight`: Konva 10 stores the font size there. `height()` is the wrapped
  // block when no frame height was set on the node — and a frame height must not be set, because
  // Konva then stops laying out lines that don't fit instead of painting them.
  const textHeight = Math.max(
    node.height(),
    input.element.fontSize * input.element.lineHeight,
  )

  node.destroy()

  return {
    textWidth,
    textHeight,
  }
}

export interface TextMeasureSnapshot {
  /** Single-line width (Konva `getTextWidth`, no wrap). */
  naturalWidth: number
  /** Height of that single line. */
  naturalHeight: number
  /** Height when wrapped by words at exactly `width`. */
  heightAtWidth: (width: number) => number
}

export function measureTextBox(
  element: TextPlaceholder,
  text: string,
): TextMeasureSnapshot {
  const natural = measureKonvaText({ text, element })

  return {
    naturalWidth: natural.textWidth,
    naturalHeight: natural.textHeight,
    heightAtWidth: (width: number) =>
      measureKonvaText({ text, element, maxWidth: Math.max(1, width) })
        .textHeight,
  }
}
