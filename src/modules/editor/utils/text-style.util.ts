import type { TextPlaceholder } from '../models/text-placeholder.model'

export function resolveKonvaFontStyle(element: TextPlaceholder): string {
  const bold = element.fontWeight >= 600
  const italic = element.fontItalic

  if (bold && italic) {
    return 'bold italic'
  }

  if (bold) {
    return 'bold'
  }

  if (italic) {
    return 'italic'
  }

  return 'normal'
}

export function buildCanvasFont(element: TextPlaceholder): string {
  return `${resolveKonvaFontStyle(element)} ${element.fontSize}px ${element.fontFamily}`
}
