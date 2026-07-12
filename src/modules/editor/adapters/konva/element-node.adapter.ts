import type { PageElement } from '../../models'
import type { PhotoPlaceholder } from '../../models/photo-placeholder.model'
import { hasPhotoStroke } from '../../utils/element-stroke.util'
import type { TextPlaceholder } from '../../models/text-placeholder.model'
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
    rotation: isTextPlaceholderType(element.type) ? 0 : element.rotation,
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
  }
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

export function getTextConfig(element: PageElement, displayText?: string | null) {
  if (
    element.type !== 'text-placeholder' &&
    element.type !== 'title-placeholder' &&
    element.type !== 'subtitle-placeholder'
  ) {
    return null
  }

  const textEl = element as TextPlaceholder
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

export function getElementHitAreaConfig(element: PageElement) {
  if (element.type === 'background' || !element.visible) {
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
