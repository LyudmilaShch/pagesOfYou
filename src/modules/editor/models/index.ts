export type { Position, Size } from './geometry.model'
export type { PageElementType, PageElementBase } from './page-element.model'
export type { PhotoFitMode, PhotoPlaceholder } from './photo-placeholder.model'
export type {
  TextAlign,
  TextPlaceholder,
  TextSizingMode,
  TextTransform,
  TextVerticalAlign,
} from './text-placeholder.model'
export type { TitlePlaceholder, SubtitlePlaceholder } from './title-placeholder.model'
export type { ShapeElement } from './shape-element.model'
export type { EditorDocument } from './page-template.model'
export type { CanvasData } from './canvas-data.model'
export { CANVAS_DATA_VERSION, createEmptyCanvasData, normalizeCanvasData } from './canvas-data.model'

import type { PhotoPlaceholder } from './photo-placeholder.model'
import type { ShapeElement } from './shape-element.model'
import type {
  SubtitlePlaceholder,
  TitlePlaceholder,
} from './title-placeholder.model'
import type { TextPlaceholder } from './text-placeholder.model'

export type PageElement =
  | PhotoPlaceholder
  | TextPlaceholder
  | TitlePlaceholder
  | SubtitlePlaceholder
  | ShapeElement

export function isTextElement(
  element: PageElement,
): element is TextPlaceholder | TitlePlaceholder | SubtitlePlaceholder {
  return (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  )
}

export function isShapeElement(element: PageElement): element is ShapeElement {
  return (
    element.type === 'shape-rectangle' ||
    element.type === 'shape-circle' ||
    element.type === 'shape-line'
  )
}

export function isPhotoElement(element: PageElement): element is PhotoPlaceholder {
  return element.type === 'photo-placeholder'
}
