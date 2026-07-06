import Konva from 'konva'

import { TEXT_WIDTH_BUFFER } from '../constants/text.constants'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import { buildCanvasFont, resolveKonvaFontStyle } from './text-style.util'

export interface TextMeasureInput {
  text: string
  element: TextPlaceholder
  maxWidth?: number
}

export interface TextMeasureResult {
  textWidth: number
  textHeight: number
}

export function measureTextLineWidth(text: string, element: TextPlaceholder): number {
  const content = text.length > 0 ? text : ' '

  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d')

    if (context) {
      context.font = buildCanvasFont(element)
      let width = context.measureText(content).width

      if (element.letterSpacing && content.length > 1) {
        width += element.letterSpacing * (content.length - 1)
      }

      return Math.ceil(width)
    }
  }

  return measureKonvaText({ text: content, element }).textWidth
}

export function shouldWrapTextContent(
  text: string,
  element: TextPlaceholder,
  innerWidth: number,
): boolean {
  if (element.textSizingMode === 'fixed') {
    return true
  }

  const naturalWidth = measureTextLineWidth(text, element)
  return naturalWidth > innerWidth + 1
}

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
  const textHeight = Math.max(node.height(), input.element.fontSize * input.element.lineHeight)

  node.destroy()

  return {
    textWidth,
    textHeight,
  }
}

export function measureTextLineWidthWithBuffer(text: string, element: TextPlaceholder): number {
  return measureTextLineWidth(text, element) + TEXT_WIDTH_BUFFER
}
