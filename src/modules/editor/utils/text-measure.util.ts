import Konva from 'konva'

import type { TextAlign, TextPlaceholder, TextVerticalAlign } from '../models/text-placeholder.model'
import { resolveKonvaFontStyle } from './text-style.util'

export interface TextInkRect {
  x: number
  y: number
  width: number
  height: number
}

/** Glyph box inside a text frame. A line wider than the frame spills out: right-aligned
 * text spills to the left, which is how a page number sits outside its row box. */
export function inkRectFromLineWidths(input: {
  boxWidth: number
  boxHeight: number
  lineWidths: number[]
  blockHeight: number
  align: TextAlign
  verticalAlign: TextVerticalAlign
}): TextInkRect {
  const widths = input.lineWidths.filter((width) => width > 0)
  if (widths.length === 0 || input.blockHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const maxLine = Math.max(...widths)
  const boxWidth = Math.max(1, input.boxWidth)
  let x = 0
  let width = maxLine
  if (input.align === 'right') {
    x = boxWidth - maxLine
  } else if (input.align === 'center') {
    x = (boxWidth - maxLine) / 2
  } else if (input.align === 'justify' && widths.length > 1) {
    x = 0
    width = Math.max(boxWidth, maxLine)
  }

  const slack = input.boxHeight - input.blockHeight
  let y = 0
  if (slack > 1 && input.verticalAlign === 'middle') {
    y = slack / 2
  } else if (slack > 1 && input.verticalAlign === 'bottom') {
    y = slack
  }

  return { x, y, width, height: input.blockHeight }
}

function estimatedInkRect(element: TextPlaceholder, text: string): TextInkRect {
  const content = text.trim()
  if (!content) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const fontSize = element.fontSize > 0 ? element.fontSize : 16
  const boxWidth = Math.max(1, element.size.width)
  const lineHeight = element.lineHeight || 1.2
  const charWidth = fontSize * 0.5
  const charsPerLine = Math.max(1, Math.floor(boxWidth / charWidth))
  const lineCount = content.split('\n').reduce(
    (count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0,
  )
  const blockHeight = fontSize * lineHeight * lineCount

  return inkRectFromLineWidths({
    boxWidth,
    boxHeight: Math.max(element.size.height, blockHeight, 1),
    lineWidths: [Math.min(boxWidth, content.length * charWidth)],
    blockHeight,
    align: element.textAlign,
    verticalAlign: element.verticalAlign ?? 'top',
  })
}

/** Where the letters actually paint, in the text element's own coordinates. */
export function getTextInkRect(element: TextPlaceholder, text: string): TextInkRect {
  const content = text.trim()
  if (!content) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  try {
    const boxWidth = Math.max(1, element.size.width)
    const node = new Konva.Text({
      text: content,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontStyle: resolveKonvaFontStyle(element),
      lineHeight: element.lineHeight,
      letterSpacing: element.letterSpacing,
      align: element.textAlign,
      wrap: 'word',
      width: boxWidth,
    })
    const blockHeight = Math.max(node.height(), element.fontSize * (element.lineHeight || 1))
    const lineWidths = ((node as Konva.Text & { textArr?: Array<{ width: number }> }).textArr ?? []).map(
      (line) => line.width,
    )
    node.destroy()

    return inkRectFromLineWidths({
      boxWidth,
      boxHeight: Math.max(1, element.size.height),
      lineWidths,
      blockHeight,
      align: element.textAlign,
      verticalAlign: element.verticalAlign ?? 'top',
    })
  } catch {
    return estimatedInkRect(element, content)
  }
}

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
