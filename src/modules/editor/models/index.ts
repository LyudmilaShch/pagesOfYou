export type { Position, Size } from './geometry.model'
export type { PageElementType, PageElementBase } from './page-element.model'
export type { PhotoFitMode, PhotoPlaceholder } from './photo-placeholder.model'
export type {
  PhotoFilter,
  PhotoFilterPresetKey,
  PhotoFilterPresetDef,
  PhotoCorrectionParams,
} from './photo-filter.model'
export {
  PHOTO_FILTER_PRESETS,
  PHOTO_CORRECTION_NEUTRAL,
  getPhotoFilterPresetDef,
  isCustomPhotoFilter,
  getPhotoFilterLabel,
  lerpCorrection,
} from './photo-filter.model'
export type {
  TextAlign,
  TextPlaceholder,
  TextSizingMode,
  TextTransform,
  TextVerticalAlign,
} from './text-placeholder.model'
export type {
  TextEffect,
  TextEffectType,
  TextEffectCardDef,
  DropShadowEffectParams,
  GlowEffectParams,
  EchoEffectParams,
  OutlinedEffectParams,
  BackgroundEffectParams,
  StrokeEffectParams,
  NeonEffectParams,
} from './text-effect.model'
export { TEXT_EFFECT_CARDS, getTextEffectCardDef } from './text-effect.model'
export type { TitlePlaceholder, SubtitlePlaceholder } from './title-placeholder.model'
export type { ShapeElement } from './shape-element.model'
export type {
  ShapeShadow,
  ShapeShadowType,
  DropShapeShadowParams,
  InnerShapeShadowParams,
  SoftShapeShadowParams,
  LongShapeShadowParams,
} from './shape-shadow.model'
export { SHAPE_SHADOW_DESCRIPTORS } from './shape-shadow.model'
export type {
  ShapeVisualEffect,
  ShapeVisualEffectType,
  GlowShapeEffectParams,
  NeonShapeEffectParams,
  BlurShapeEffectParams,
  GlassShapeEffectParams,
  GradientShapeEffectParams,
} from './shape-visual-effect.model'
export { SHAPE_VISUAL_EFFECT_DESCRIPTORS } from './shape-visual-effect.model'
export type {
  EffectDescriptor,
  EffectFieldDef,
  EffectExtraNodeSpec,
  ShapeGeometry,
} from './effect-descriptor.model'
export { findDescriptor } from './effect-descriptor.model'
export type { GroupElement } from './group-element.model'
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
import type { GroupElement } from './group-element.model'

/** Leaf node — everything that isn't a container. */
export type LeafElement =
  | PhotoPlaceholder
  | TextPlaceholder
  | TitlePlaceholder
  | SubtitlePlaceholder
  | ShapeElement

export type PageElement = LeafElement | GroupElement

export function isGroupElement(element: PageElement): element is GroupElement {
  return element.type === 'group'
}

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
