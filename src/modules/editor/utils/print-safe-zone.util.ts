import {
  PRINT_CROP_FILL,
  PRINT_CROP_FILL_ACTIVE,
  PRINT_CROP_MARGIN,
  PRINT_SAFE_MARGIN,
  PRINT_SAFE_ZONE_STROKE,
} from '../constants/page.constants'
import { buildSpreadPrintSafeZoneOverlay, getSpreadPageBounds, getSpreadPageSide, isSpreadCanvas } from './spread.util'

export interface PrintCropBoundsInput {
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  visible: boolean
  type: string
  printCropAllowed?: boolean
}

export interface ElementAxisAlignedBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PrintCropZoneRectConfig {
  key: string
  x: number
  y: number
  width: number
  height: number
  fill: string
}

export interface PrintSafeZoneLineConfig {
  key: string
  points: number[]
  stroke: string
  strokeWidth: number
  dash: number[]
}

export interface PrintSafeZoneOverlay {
  cropRects: PrintCropZoneRectConfig[]
  safeLines: PrintSafeZoneLineConfig[]
}

export function getElementAxisAlignedBounds(
  element: PrintCropBoundsInput,
): ElementAxisAlignedBounds {
  const { x, y } = element.position
  const { width, height } = element.size
  const rotation = element.rotation ?? 0

  if (rotation === 0) {
    return {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
    }
  }

  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map(({ x: cornerX, y: cornerY }) => ({
    x: x + cornerX * cos - cornerY * sin,
    y: y + cornerX * sin + cornerY * cos,
  }))

  return {
    left: Math.min(...corners.map((corner) => corner.x)),
    top: Math.min(...corners.map((corner) => corner.y)),
    right: Math.max(...corners.map((corner) => corner.x)),
    bottom: Math.max(...corners.map((corner) => corner.y)),
  }
}

export function elementIntersectsPrintCropZone(
  element: PrintCropBoundsInput,
  pageWidth: number,
  pageHeight: number,
  cropMargin: number = PRINT_CROP_MARGIN,
): boolean {
  if (element.printCropAllowed) {
    return false
  }

  if (!element.visible || element.type === 'background') {
    return false
  }

  if (isSpreadCanvas(pageWidth, pageHeight)) {
    const side = getSpreadPageSide(
      element.position.x,
      pageWidth,
      pageHeight,
      element.size.width,
    )
    const bounds = getSpreadPageBounds(side, pageHeight)

    return elementIntersectsPrintCropZone(
      {
        ...element,
        position: {
          x: element.position.x - bounds.originX,
          y: element.position.y,
        },
      },
      bounds.width,
      bounds.height,
      cropMargin,
    )
  }

  if (
    cropMargin <= 0 ||
    cropMargin * 2 >= pageWidth ||
    cropMargin * 2 >= pageHeight
  ) {
    return false
  }

  const bounds = getElementAxisAlignedBounds(element)
  const innerLeft = cropMargin
  const innerTop = cropMargin
  const innerRight = pageWidth - cropMargin
  const innerBottom = pageHeight - cropMargin

  return (
    bounds.left < innerLeft ||
    bounds.top < innerTop ||
    bounds.right > innerRight ||
    bounds.bottom > innerBottom
  )
}

export function hasElementsInPrintCropZone(
  elements: PrintCropBoundsInput[],
  pageWidth: number,
  pageHeight: number,
  cropMargin: number = PRINT_CROP_MARGIN,
): boolean {
  return getElementsInPrintCropZone(elements, pageWidth, pageHeight, cropMargin).length > 0
}

export function getElementsInPrintCropZone(
  elements: PrintCropBoundsInput[],
  pageWidth: number,
  pageHeight: number,
  cropMargin: number = PRINT_CROP_MARGIN,
): PrintCropBoundsInput[] {
  return elements.filter((element) =>
    elementIntersectsPrintCropZone(element, pageWidth, pageHeight, cropMargin),
  )
}

function buildSafeZoneLines(
  pageWidth: number,
  pageHeight: number,
  margin: number,
): PrintSafeZoneLineConfig[] {
  const left = margin
  const top = margin
  const right = pageWidth - margin
  const bottom = pageHeight - margin

  return [
    {
      key: 'safe-top',
      points: [left, top, right, top],
      stroke: PRINT_SAFE_ZONE_STROKE,
      strokeWidth: 1,
      dash: [6, 4],
    },
    {
      key: 'safe-right',
      points: [right, top, right, bottom],
      stroke: PRINT_SAFE_ZONE_STROKE,
      strokeWidth: 1,
      dash: [6, 4],
    },
    {
      key: 'safe-bottom',
      points: [left, bottom, right, bottom],
      stroke: PRINT_SAFE_ZONE_STROKE,
      strokeWidth: 1,
      dash: [6, 4],
    },
    {
      key: 'safe-left',
      points: [left, top, left, bottom],
      stroke: PRINT_SAFE_ZONE_STROKE,
      strokeWidth: 1,
      dash: [6, 4],
    },
  ]
}

export function buildPrintSafeZoneOverlay(
  pageWidth: number,
  pageHeight: number,
  cropMargin: number = PRINT_CROP_MARGIN,
  safeMargin: number = PRINT_SAFE_MARGIN,
  highlightCrop = false,
): PrintSafeZoneOverlay {
  if (isSpreadCanvas(pageWidth, pageHeight)) {
    return buildSpreadPrintSafeZoneOverlay(cropMargin, safeMargin, highlightCrop)
  }

  if (
    cropMargin <= 0 ||
    safeMargin <= cropMargin ||
    safeMargin * 2 >= pageWidth ||
    safeMargin * 2 >= pageHeight
  ) {
    return { cropRects: [], safeLines: [] }
  }

  const cropFill = highlightCrop ? PRINT_CROP_FILL_ACTIVE : PRINT_CROP_FILL
  const innerHeight = pageHeight - cropMargin * 2

  const cropRects: PrintCropZoneRectConfig[] = [
    {
      key: 'crop-top',
      x: 0,
      y: 0,
      width: pageWidth,
      height: cropMargin,
      fill: cropFill,
    },
    {
      key: 'crop-bottom',
      x: 0,
      y: pageHeight - cropMargin,
      width: pageWidth,
      height: cropMargin,
      fill: cropFill,
    },
    {
      key: 'crop-left',
      x: 0,
      y: cropMargin,
      width: cropMargin,
      height: innerHeight,
      fill: cropFill,
    },
    {
      key: 'crop-right',
      x: pageWidth - cropMargin,
      y: cropMargin,
      width: cropMargin,
      height: innerHeight,
      fill: cropFill,
    },
  ]

  return {
    cropRects,
    safeLines: buildSafeZoneLines(pageWidth, pageHeight, safeMargin),
  }
}
