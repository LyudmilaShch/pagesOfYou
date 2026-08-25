import Konva from 'konva'

import type { PageElement } from '../../models'
import type { PhotoPlaceholder } from '../../models/photo-placeholder.model'
import { hasPhotoStroke } from '../../utils/element-stroke.util'
import type { TextPlaceholder } from '../../models/text-placeholder.model'
import type { TextEffect } from '../../models/text-effect.model'
import type { PhotoFilter } from '../../models/photo-filter.model'
import { SHAPE_SHADOW_DESCRIPTORS } from '../../models/shape-shadow.model'
import { SHAPE_VISUAL_EFFECT_DESCRIPTORS } from '../../models/shape-visual-effect.model'
import { findDescriptor } from '../../models/effect-descriptor.model'
import type { EffectExtraNodeSpec, ShapeGeometry } from '../../models/effect-descriptor.model'
import { parseCssColor, formatCssColor } from '../../utils/color-format.util'
import {
  TEXT_BOX_PADDING,
} from '../../constants/text.constants'
import {
  PHOTO_PLACEHOLDER_DIM_OUTSIDE_OPACITY,
  PHOTO_PLACEHOLDER_STROKE,
  TRANSFORMER_ANCHOR_STROKE,
  TRANSFORMER_ANCHOR_STROKE_WIDTH,
  TRANSFORMER_BORDER_STROKE,
  TRANSFORMER_BORDER_STROKE_WIDTH,
  TRANSFORMER_CORNER_ANCHOR_SIZE,
} from '../../constants/page.constants'
import { TEXT_VERTICAL_ALIGN_DEFAULT } from '../../utils/normalize-text-placeholder.util'
import { isTextPlaceholderType } from '../../utils/normalize-text-placeholder.util'
import { resolveKonvaFontStyle } from '../../utils/text-style.util'
import { shouldWrapTextContent } from '../../utils/text-measure.util'
import {
  clampPhotoCrop,
  computePhotoImageLayout,
  computePhotoKonvaImageLayout,
  getImagePixelSize,
  getPhotoCropState,
  getPhotoLayoutCornerPosition,
  resolvePhotoRenderFitMode,
  type PhotoImageLayout,
  type PhotoScaleCorner,
} from '../../utils/photo-crop.util'
import { getPhotoPlaceholderCheckerPattern } from '../../utils/photo-placeholder-pattern.util'
import {
  buildFrameNineSliceConfigs,
  getPhotoRenderBox,
  type NineSliceImageConfig,
} from '../../utils/photo-frame.util'
import { getElementTransformNodeId } from '../../utils/element-pivot.util'

export { resolveKonvaFontStyle }

export interface KonvaGroupConfig {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  offsetX?: number
  offsetY?: number
  rotation: number
  opacity: number
  visible: boolean
  draggable: boolean
  name: string
}

export function getElementOuterGroupConfig(element: PageElement): KonvaGroupConfig {
  return {
    id: element.id,
    x: element.position.x,
    y: element.position.y,
    opacity: element.opacity,
    visible: element.visible,
    draggable: !element.locked,
    rotation: 0,
    name: 'editor-element',
  }
}

export function getElementInnerGroupConfig(element: PageElement) {
  const width = element.size.width
  const height = Math.max(
    element.size.height,
    element.type === 'shape-line' ? 0 : 1,
  )

  return {
    id: getElementTransformNodeId(element.id),
    x: width / 2,
    y: height / 2,
    offsetX: width / 2,
    offsetY: height / 2,
    width,
    height,
    rotation: element.rotation,
  }
}

/** @deprecated Use getElementOuterGroupConfig for position and getElementInnerGroupConfig for rotation. */
export function getElementGroupConfig(element: PageElement): KonvaGroupConfig {
  return getElementOuterGroupConfig(element)
}

export function getPhotoPlaceholderGridConfig(element: PageElement) {
  if (element.type !== 'photo-placeholder') {
    return null
  }

  const hasUserStrokes = element.type === 'photo-placeholder' && hasPhotoStroke(element)
  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    fillPatternImage: getPhotoPlaceholderCheckerPattern(),
    fillPatternRepeat: 'repeat',
    stroke: hasUserStrokes ? 'transparent' : PHOTO_PLACEHOLDER_STROKE,
    strokeWidth: hasUserStrokes ? 0 : 1,
    cornerRadius: element.borderRadius,
    listening: false,
  }
}
export function getPhotoPlaceholderRectConfig(
  element: PageElement,
  options?: { showEditorChrome?: boolean },
) {
  if (element.type !== 'photo-placeholder') {
    return null
  }

  if (options?.showEditorChrome === false) {
    return null
  }

  return getPhotoPlaceholderGridConfig(element)
}

export function getPhotoPlaceholderIconLines(element: PageElement) {
  if (element.type !== 'photo-placeholder') {
    return []
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)
  const iconSize = Math.min(box.width * 0.22, box.height * 0.18, 44)
  const left = box.x + box.width / 2 - iconSize / 2
  const top = box.y + box.height / 2 - iconSize / 2 - 10
  const stroke = '#B8B0A6'

  return [
    {
      points: [
        left,
        top + iconSize,
        left + iconSize * 0.32,
        top + iconSize * 0.52,
        left + iconSize * 0.52,
        top + iconSize * 0.68,
        left + iconSize,
        top + iconSize * 0.38,
        left + iconSize,
        top + iconSize,
      ],
      stroke,
      strokeWidth: 1.5,
      lineJoin: 'round',
      closed: true,
      listening: false,
    },
    {
      points: [
        left + iconSize * 0.62,
        top + iconSize * 0.28,
        left + iconSize * 0.72,
        top + iconSize * 0.42,
        left + iconSize * 0.86,
        top + iconSize * 0.34,
      ],
      stroke,
      strokeWidth: 1.5,
      lineCap: 'round',
      listening: false,
    },
    {
      points: [
        left,
        top,
        left + iconSize,
        top,
        left + iconSize,
        top + iconSize,
        left,
        top + iconSize,
        left,
        top,
      ],
      stroke,
      strokeWidth: 1.5,
      lineJoin: 'round',
      listening: false,
    },
  ]
}

export function getPhotoPlaceholderEmptyHintConfig(element: PageElement) {
  if (element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y + box.height / 2 + 18,
    width: box.width,
    text: 'Перетащите фото',
    fontSize: 11,
    fontFamily: 'Inter',
    fill: '#8A8580',
    align: 'center',
    listening: false,
  }
}

export function getPhotoDropHighlightConfig(
  element: PageElement,
  isActive: boolean,
) {
  if (!isActive || element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    stroke: '#2563EB',
    strokeWidth: 2,
    dash: [6, 4],
    cornerRadius: element.borderRadius,
    listening: false,
  }
}

export function getPhotoCropEditingBorderConfig(
  element: PageElement,
  isActive: boolean,
) {
  if (!isActive || element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    stroke: '#111111',
    strokeWidth: 2,
    cornerRadius: element.borderRadius,
    listening: false,
  }
}

export function getPhotoClipGroupConfig(element: PageElement) {
  if (element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)
  const { x, y, width, height } = box
  const radius = element.borderRadius

  if (radius > 0) {
    return {
      listening: false,
      clipFunc: (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height - radius)
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        ctx.lineTo(x + radius, y + height)
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
      },
    }
  }

  return {
    listening: false,
    clip: {
      x,
      y,
      width,
      height,
    },
  }
}

function getPhotoCoverLayout(element: PageElement, image: HTMLImageElement): PhotoImageLayout | null {
  const { width: imageWidth, height: imageHeight } = getImagePixelSize(image)

  if (element.type !== 'photo-placeholder' || imageWidth <= 0 || imageHeight <= 0) {
    return null
  }

  const photo = element as PhotoPlaceholder
  const box = getPhotoRenderBox(photo.frame, photo.size.width, photo.size.height)
  const crop = clampPhotoCrop(
    box.width,
    box.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(photo.fitMode),
    getPhotoCropState(photo),
  )

  const layout = computePhotoImageLayout(
    box.width,
    box.height,
    imageWidth,
    imageHeight,
    'cover',
    crop,
  )

  if (!layout) {
    return null
  }

  return { ...layout, x: layout.x + box.x, y: layout.y + box.y }
}

export function getPhotoRepositionBoundsConfig(element: PageElement, image: HTMLImageElement) {
  const layout = getPhotoCoverLayout(element, image)

  if (!layout) {
    return null
  }

  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    stroke: TRANSFORMER_BORDER_STROKE,
    strokeWidth: TRANSFORMER_BORDER_STROKE_WIDTH,
    listening: false,
  }
}

export function getPhotoScaleHandleConfigs(element: PageElement, image: HTMLImageElement) {
  const layout = getPhotoCoverLayout(element, image)

  if (!layout) {
    return []
  }

  const corners: PhotoScaleCorner[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]

  return corners.map((corner) => ({
    corner,
    config: {
      ...getPhotoLayoutCornerPosition(layout, corner),
      radius: TRANSFORMER_CORNER_ANCHOR_SIZE / 2,
      fill: '#FFFFFF',
      stroke: TRANSFORMER_ANCHOR_STROKE,
      strokeWidth: TRANSFORMER_ANCHOR_STROKE_WIDTH,
      hitStrokeWidth: 14,
      name: 'photo-scale-handle',
      listening: true,
      draggable: false,
      perfectDrawEnabled: false,
    },
  }))
}

export function getPhotoRepositionPanHitConfig(element: PageElement, image: HTMLImageElement) {
  const layout = getPhotoCoverLayout(element, image)

  if (!layout) {
    return null
  }

  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    fill: 'rgba(0, 0, 0, 0.001)',
    listening: true,
    draggable: false,
    name: 'photo-reposition-pan',
  }
}

export function getPhotoPlaceholderPanHitConfig(element: PageElement) {
  if (element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    cornerRadius: element.borderRadius,
    fill: 'rgba(0, 0, 0, 0.001)',
    listening: true,
    draggable: false,
    name: 'photo-placeholder-pan',
  }
}

export function getPhotoRepositionLayerConfig(
  element: PageElement,
  image: HTMLImageElement,
  layer: 'outside' | 'inside',
) {
  const layout = getPhotoCoverLayout(element, image)

  if (!layout) {
    return null
  }

  if (layer === 'outside') {
    return {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      opacity: PHOTO_PLACEHOLDER_DIM_OUTSIDE_OPACITY,
      listening: false,
      draggable: false,
    }
  }

  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    opacity: 1,
    listening: false,
    draggable: false,
  }
}

export function getPhotoDimBorderConfig(element: PageElement, isActive: boolean) {
  if (!isActive || element.type !== 'photo-placeholder') {
    return null
  }

  const box = getPhotoRenderBox(element.frame, element.size.width, element.size.height)

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    stroke: TRANSFORMER_BORDER_STROKE,
    strokeWidth: TRANSFORMER_BORDER_STROKE_WIDTH,
    cornerRadius: element.borderRadius,
    listening: false,
  }
}

export function getPhotoImageKonvaConfig(element: PageElement, image: HTMLImageElement) {
  const { width: imageWidth, height: imageHeight } = getImagePixelSize(image)

  if (element.type !== 'photo-placeholder' || imageWidth <= 0 || imageHeight <= 0) {
    return null
  }

  const photo = element as PhotoPlaceholder
  const box = getPhotoRenderBox(photo.frame, photo.size.width, photo.size.height)
  const konvaLayout = computePhotoKonvaImageLayout(
    box.width,
    box.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(photo.fitMode),
    getPhotoCropState(photo),
  )

  if (!konvaLayout) {
    return null
  }

  return {
    x: konvaLayout.x + box.x,
    y: konvaLayout.y + box.y,
    width: konvaLayout.width,
    height: konvaLayout.height,
    crop: konvaLayout.crop,
    cornerRadius: photo.borderRadius,
    listening: false,
    ...getPhotoFilterKonvaAttrs(photo.filter),
  }
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

/**
 * A "temperature" shift has no native Konva filter — this is a small custom filter function
 * (Konva accepts any `(imageData: ImageData) => void`, not just its own Konva.Filters.*) that
 * nudges the red/blue channels apart to read as warmer (positive) or cooler (negative).
 */
function createTemperatureFilter(value: number): typeof Konva.Filters.Brighten {
  const delta = (value / 100) * 40
  return function temperatureFilter(imageData: ImageData): void {
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByte(data[i] + delta)
      data[i + 2] = clampByte(data[i + 2] - delta)
    }
  }
}

/**
 * Builds the Konva `filters` array + the attribute values those filters read (brightness/
 * contrast/hue/saturation/blurRadius are generic Konva.Node attrs, wired up the same way
 * shadow/stroke attrs are for text effects). Only includes filters whose value actually differs
 * from neutral, keeping the pipeline cheap when most sliders are untouched.
 */
function getPhotoFilterKonvaAttrs(filter: PhotoFilter | null): Record<string, unknown> {
  if (!filter) {
    return { filters: [] }
  }

  const { brightness, contrast, saturation, temperature, hue, blur } = filter.correction
  const filters: Array<typeof Konva.Filters.Brighten> = []
  const attrs: Record<string, unknown> = {}

  if (brightness !== 0) {
    filters.push(Konva.Filters.Brighten)
    attrs.brightness = brightness / 100
  }
  if (contrast !== 0) {
    filters.push(Konva.Filters.Contrast)
    attrs.contrast = contrast
  }
  if (saturation !== 0 || hue !== 0) {
    filters.push(Konva.Filters.HSL)
    attrs.hue = hue
    attrs.saturation = (saturation / 100) * 4
    attrs.luminance = 0
  }
  if (blur > 0) {
    filters.push(Konva.Filters.Blur)
    attrs.blurRadius = blur
  }
  if (temperature !== 0) {
    filters.push(createTemperatureFilter(temperature))
  }

  return { filters, ...attrs }
}

/** Decorative 9-slice frame overlay — drawn on top of the photo, independent of its crop/scale. */
export function getPhotoFrameImageConfigs(element: PageElement): NineSliceImageConfig[] {
  if (element.type !== 'photo-placeholder') {
    return []
  }

  const photo = element as PhotoPlaceholder

  if (!photo.frame) {
    return []
  }

  return buildFrameNineSliceConfigs(photo.frame, element.size.width, element.size.height)
}

type ShapeLikeElement = Extract<PageElement, { type: 'shape-rectangle' | 'shape-circle' | 'shape-line' }>

function isShapeLikeElement(element: PageElement): element is ShapeLikeElement {
  return (
    element.type === 'shape-rectangle' ||
    element.type === 'shape-circle' ||
    element.type === 'shape-line'
  )
}

function getShapeGeometry(element: ShapeLikeElement): ShapeGeometry {
  return {
    type: element.type,
    width: element.size.width,
    height: element.size.height,
    cornerRadius: element.type === 'shape-rectangle' ? element.cornerRadius ?? 0 : 0,
  }
}

/**
 * Merges the active shadow's and active visual effect's Konva attrs onto the shape's own config.
 * Konva only supports one native shadow per node — if both the shadow AND the chosen effect use
 * the shadow* mechanism (glow/neon do), the effect's values win since it's spread in last. This
 * is a known, accepted limitation of layering two shadow-based treatments at once.
 */
function getShapeEffectKonvaAttrs(element: ShapeLikeElement): Record<string, unknown> {
  const geometry = getShapeGeometry(element)

  const shadowAttrs = element.shadow
    ? (findDescriptor(SHAPE_SHADOW_DESCRIPTORS, element.shadow.type).getKonvaAttrs?.(
        element.shadow.params,
        geometry,
      ) ?? {})
    : {}
  const effectAttrs = element.visualEffect
    ? (findDescriptor(SHAPE_VISUAL_EFFECT_DESCRIPTORS, element.visualEffect.type).getKonvaAttrs?.(
        element.visualEffect.params,
        geometry,
      ) ?? {})
    : {}

  return { ...shadowAttrs, ...effectAttrs }
}

/** Sibling nodes the active shadow/effect need beyond plain attrs (offset copies, tint overlays, clipped insets). */
export function getShapeExtraNodes(element: PageElement): EffectExtraNodeSpec[] {
  if (!isShapeLikeElement(element)) {
    return []
  }

  const geometry = getShapeGeometry(element)

  const shadowNodes = element.shadow
    ? (findDescriptor(SHAPE_SHADOW_DESCRIPTORS, element.shadow.type).getExtraNodes?.(
        element.shadow.params,
        geometry,
      ) ?? [])
    : []
  const effectNodes = element.visualEffect
    ? (findDescriptor(SHAPE_VISUAL_EFFECT_DESCRIPTORS, element.visualEffect.type).getExtraNodes?.(
        element.visualEffect.params,
        geometry,
      ) ?? [])
    : []

  return [...shadowNodes, ...effectNodes]
}

export function getShapeRectConfig(element: PageElement) {
  if (element.type !== 'shape-rectangle') {
    return null
  }

  return {
    width: element.size.width,
    height: element.size.height,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    cornerRadius: element.cornerRadius ?? 0,
    ...getShapeEffectKonvaAttrs(element),
  }
}

export function getShapeCircleConfig(element: PageElement) {
  if (element.type !== 'shape-circle') {
    return null
  }

  return {
    x: element.size.width / 2,
    y: element.size.height / 2,
    radius: Math.min(element.size.width, element.size.height) / 2,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    ...getShapeEffectKonvaAttrs(element),
  }
}

export function getShapeLineConfig(element: PageElement) {
  if (element.type !== 'shape-line') {
    return null
  }

  return {
    points: [0, 0, element.size.width, 0],
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    lineCap: 'round',
    hitStrokeWidth: 16,
    ...getShapeEffectKonvaAttrs(element),
  }
}

export function resolveTextContent(
  element: TextPlaceholder,
  displayText?: string | null,
): string {
  const raw =
    displayText?.trim() ||
    element.defaultText?.trim() ||
    element.label?.trim() ||
    ''

  if (element.textTransform === 'uppercase') {
    return raw.toUpperCase()
  }

  return raw
}

function buildBaseTextConfig(textEl: TextPlaceholder, displayText?: string | null) {
  const text = resolveTextContent(textEl, displayText)
  const innerWidth = Math.max(1, textEl.size.width - TEXT_BOX_PADDING * 2)
  const useWrap = shouldWrapTextContent(text, textEl, innerWidth)

  return {
    x: TEXT_BOX_PADDING,
    y: TEXT_BOX_PADDING,
    text,
    fontFamily: textEl.fontFamily,
    fontSize: textEl.fontSize,
    fontStyle: resolveKonvaFontStyle(textEl),
    lineHeight: textEl.lineHeight,
    letterSpacing: textEl.letterSpacing,
    align: textEl.textAlign,
    fill: textEl.color ?? '#111111',
    verticalAlign: textEl.verticalAlign ?? TEXT_VERTICAL_ALIGN_DEFAULT,
    wrap: useWrap ? 'word' : 'none',
    ...(useWrap ? { width: innerWidth } : {}),
  }
}

function getTextPlaceholderElement(element: PageElement): TextPlaceholder | null {
  if (
    element.type !== 'text-placeholder' &&
    element.type !== 'title-placeholder' &&
    element.type !== 'subtitle-placeholder'
  ) {
    return null
  }

  return element as TextPlaceholder
}

export function getTextConfig(element: PageElement, displayText?: string | null) {
  const textEl = getTextPlaceholderElement(element)
  if (!textEl) {
    return null
  }

  return {
    ...buildBaseTextConfig(textEl, displayText),
    ...getTextEffectKonvaProps(textEl.effect),
  }
}

/**
 * Echo copies must be siblings the caller renders *before* the main text node so Konva draws
 * them underneath it. But Konva's vue bindings append a node to its parent the moment it first
 * mounts — regardless of where it sits in the template — so a layer that mounts *after* the main
 * text (e.g. the first time the user turns the echo effect on) would render on top of it instead
 * of behind it. To sidestep that, this always returns a fixed-length array of layer slots (so
 * they all mount once, together with the main text, before any effect is ever chosen) and toggles
 * unused slots via `visible: false` rather than adding/removing nodes later.
 */
const ECHO_MAX_COPIES = 8

export function getTextEchoLayerConfigs(element: PageElement, displayText?: string | null) {
  const textEl = getTextPlaceholderElement(element)
  if (!textEl) {
    return null
  }

  const base = buildBaseTextConfig(textEl, displayText)
  const effect = textEl.effect
  const isEcho = effect?.type === 'echo'
  const { color, copies, offset, opacity } = effect?.type === 'echo'
    ? effect.params
    : { color: base.fill, copies: 0, offset: 0, opacity: 0 }
  const baseOpacity = opacity / 100

  const layers = []
  for (let slot = 1; slot <= ECHO_MAX_COPIES; slot += 1) {
    const active = isEcho && slot <= copies
    layers.push({
      ...base,
      x: base.x + offset * slot,
      y: base.y + offset * slot,
      fill: color,
      opacity: active ? baseOpacity * ((copies - slot + 1) / (copies + 1)) : 0,
      visible: active,
      listening: false,
      shadowEnabled: false,
      stroke: undefined,
    })
  }

  return layers
}

/** Applies opacity to a CSS color via rgba(), reusing the shared color-parsing helpers. */
function withAlpha(color: string, opacity: number): string {
  const parsed = parseCssColor(color)
  return formatCssColor({ ...parsed, alpha: opacity })
}

/**
 * Konva-specific rendering for text effects. 'background' needs a sibling Rect (see
 * EditorElementNode.vue's textBackgroundConfig) and 'echo' needs sibling Text layers (see
 * getTextEchoLayerConfigs above) — both are handled outside this function since a single Text
 * config object can't express them.
 */
function getTextEffectKonvaProps(effect: TextEffect | null): Record<string, unknown> {
  if (!effect) {
    return {}
  }

  switch (effect.type) {
    case 'drop-shadow':
      return {
        shadowColor: effect.params.color,
        shadowOpacity: effect.params.opacity / 100,
        shadowBlur: effect.params.blur,
        shadowOffsetX: effect.params.offsetX,
        shadowOffsetY: effect.params.offsetY,
        shadowEnabled: true,
      }
    case 'glow':
      // Approximates a uniform glow by reusing the same Konva shadow mechanism as drop-shadow,
      // with zero offset so the blur radiates evenly in all directions.
      return {
        shadowColor: effect.params.color,
        shadowOpacity: effect.params.opacity / 100,
        shadowBlur: effect.params.blur,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowEnabled: true,
      }
    case 'stroke':
      // "Контур" — only the outline remains, the letters' interior fill is hidden.
      return {
        fillEnabled: false,
        stroke:
          effect.params.opacity < 100
            ? withAlpha(effect.params.color, effect.params.opacity / 100)
            : effect.params.color,
        strokeWidth: effect.params.width,
      }
    case 'outlined':
      // "С контуром" — the normal filled text, with an outline traced around it.
      return {
        stroke:
          effect.params.opacity < 100
            ? withAlpha(effect.params.color, effect.params.opacity / 100)
            : effect.params.color,
        strokeWidth: effect.params.width,
        fillAfterStrokeEnabled: true,
      }
    case 'neon':
      // Tints the text itself to the neon color and radiates a colored shadow — 'glow' and
      // 'blur' both widen the halo (Konva only exposes one shadowBlur radius per node), while
      // 'intensity' drives how opaque/bright that halo reads.
      return {
        fill: effect.params.color,
        shadowColor: effect.params.color,
        shadowOpacity: Math.min(1, effect.params.intensity / 100),
        shadowBlur: effect.params.blur + effect.params.glow,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowEnabled: true,
      }
    default:
      return {}
  }
}

export function getElementHitAreaConfig(element: PageElement) {
  if (!element.visible) {
    return null
  }

  if (element.type === 'shape-line') {
    return {
      x: 0,
      y: -8,
      width: Math.max(element.size.width, 1),
      height: 16,
      fill: 'rgba(0, 0, 0, 0.001)',
    }
  }

  if (isTextPlaceholderType(element.type)) {
    return {
      x: 0,
      y: 0,
      width: Math.max(element.size.width, 1),
      height: Math.max(element.size.height, 1),
      fill: 'rgba(0, 0, 0, 0.001)',
    }
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(element.size.width, 1),
    height: Math.max(element.size.height, 1),
    fill: 'rgba(0, 0, 0, 0.001)',
  }
}

export function getSelectionOutlineConfig(element: PageElement, isSelected: boolean) {
  if (!isSelected) {
    return null
  }

  return {
    width: element.size.width,
    height: element.size.height,
    stroke: '#111111',
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  }
}
