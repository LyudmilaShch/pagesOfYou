import {
  PRINT_CROP_FILL,
  PRINT_CROP_FILL_ACTIVE,
  PRINT_CROP_MARGIN,
  PRINT_SAFE_MARGIN,
  PRINT_SAFE_ZONE_STROKE,
} from '../constants/page.constants'
import type { PageElement } from '../models'
import { shapeLineLocalBounds } from './element-bounds.util'
import { buildSpreadPrintSafeZoneOverlay, getSpreadPageBounds, getSpreadPageSide, isSpreadCanvas } from './spread.util'

export interface PrintCropBoundsInput {
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  visible: boolean
  type: string
  printCropAllowed?: boolean
  strokeWidth?: number
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

function finiteRotation(rotation: number | undefined): number {
  const value = Number(rotation)
  return Number.isFinite(value) ? value : 0
}

/** Local rectangle rotated around the element's centre, the same way the canvas draws it. */
function aabbOfLocalRect(
  origin: { x: number; y: number },
  pivotSize: { width: number; height: number },
  rotationDeg: number,
  local: { x: number; y: number; width: number; height: number },
): { position: { x: number; y: number }; size: { width: number; height: number } } {
  const theta = (finiteRotation(rotationDeg) * Math.PI) / 180
  if (Math.abs(theta) < 1e-6) {
    return {
      position: { x: origin.x + local.x, y: origin.y + local.y },
      size: { width: Math.max(local.width, 0), height: Math.max(local.height, 0) },
    }
  }

  const cx = pivotSize.width / 2
  const cy = pivotSize.height / 2
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const corners = [
    [local.x, local.y],
    [local.x + local.width, local.y],
    [local.x + local.width, local.y + local.height],
    [local.x, local.y + local.height],
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of corners) {
    const dx = (px ?? 0) - cx
    const dy = (py ?? 0) - cy
    const x = origin.x + cx + dx * cos - dy * sin
    const y = origin.y + cy + dx * sin + dy * cos
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return {
    position: { x: minX, y: minY },
    size: { width: Math.max(maxX - minX, 0), height: Math.max(maxY - minY, 0) },
  }
}

interface LocalRect {
  x: number
  y: number
  width: number
  height: number
}

function isGroupElement(
  element: PageElement,
): element is PageElement & { children: PageElement[] } {
  return element.type === 'group' && Array.isArray((element as { children?: unknown }).children)
}

function isFillableText(element: PageElement): boolean {
  return (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder' ||
    element.type === 'ai-text-placeholder'
  )
}

function unionLocalRects(rects: LocalRect[]): LocalRect | null {
  if (rects.length === 0) {
    return null
  }

  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function childCropRect(child: PageElement): LocalRect | null {
  if (child.visible === false) {
    return null
  }

  if (isGroupElement(child)) {
    const inner = textAreaLocalBounds(child)
    if (!inner) {
      return null
    }
    const box = aabbOfLocalRect(child.position, child.size, child.rotation, inner)
    return {
      x: box.position.x,
      y: box.position.y,
      width: box.size.width,
      height: box.size.height,
    }
  }

  if (child.type === 'shape-line') {
    const line = shapeLineLocalBounds(child)
    return {
      x: child.position.x + line.x,
      y: child.position.y + line.y,
      width: line.width,
      height: line.height,
    }
  }

  const box = aabbOfLocalRect(child.position, child.size, child.rotation, {
    x: 0,
    y: 0,
    width: child.size.width,
    height: child.size.height,
  })
  return {
    x: box.position.x,
    y: box.position.y,
    width: box.size.width,
    height: box.size.height,
  }
}

/** Area a group can print: text by the rule above, a line by its stroke, other shapes by their box. */
function textAreaLocalBounds(element: PageElement): LocalRect | null {
  if (!isGroupElement(element)) {
    return { x: 0, y: 0, width: element.size.width, height: element.size.height }
  }

  return unionLocalRects(
    element.children.flatMap((child) => {
      const rect = childCropRect(child)
      return rect ? [rect] : []
    }),
  )
}

function boundsCheckedForCrop(element: PrintCropBoundsInput): PrintCropBoundsInput {
  if (element.type !== 'shape-line') {
    return element
  }

  const line = shapeLineLocalBounds({
    size: element.size,
    rotation: element.rotation,
    strokeWidth: element.strokeWidth,
  })
  return {
    ...element,
    rotation: 0,
    position: {
      x: element.position.x + line.x,
      y: element.position.y + line.y,
    },
    size: { width: line.width, height: line.height },
  }
}

/**
 * What the crop warning compares with the trim. A line is the painted stroke. Text and other
 * shapes use their box — a text box is the text, not empty space under it. A group is the union.
 */
export function paintedCropInput(element: PageElement): PrintCropBoundsInput {
  if (element.type === 'group') {
    const local = textAreaLocalBounds(element)
    if (!local || local.width <= 0 || local.height <= 0) {
      return {
        position: element.position,
        size: element.size,
        rotation: 0,
        visible: false,
        type: element.type,
        printCropAllowed: element.printCropAllowed,
      }
    }
    const box = aabbOfLocalRect(element.position, element.size, element.rotation, local)
    return {
      position: box.position,
      size: box.size,
      rotation: 0,
      visible: element.visible,
      type: element.type,
      printCropAllowed: element.printCropAllowed,
    }
  }

  if (isFillableText(element)) {
    const box = aabbOfLocalRect(element.position, element.size, element.rotation, {
      x: 0,
      y: 0,
      width: element.size.width,
      height: element.size.height,
    })
    return {
      ...element,
      rotation: 0,
      position: box.position,
      size: box.size,
    }
  }

  return element
}

export function pageHasPrintCropViolation(
  elements: PageElement[],
  pageWidth: number,
  pageHeight: number,
  positionOverrides?: Record<string, { x: number; y: number }>,
  cropMargin: number = PRINT_CROP_MARGIN,
): boolean {
  return (
    collectPrintCropViolations(
      elements,
      pageWidth,
      pageHeight,
      positionOverrides,
      cropMargin,
    ).length > 0
  )
}

export function collectPrintCropViolations(
  elements: PageElement[],
  pageWidth: number,
  pageHeight: number,
  positionOverrides?: Record<string, { x: number; y: number }>,
  cropMargin: number = PRINT_CROP_MARGIN,
): PageElement[] {
  return elements.filter((element) => {
    const live = positionOverrides?.[element.id]
    const placed = live ? { ...element, position: live } : element
    return elementIntersectsPrintCropZone(
      paintedCropInput(placed),
      pageWidth,
      pageHeight,
      cropMargin,
    )
  })
}

export function elementIntersectsPrintCropZone(
  element: PrintCropBoundsInput,
  pageWidth: number,
  pageHeight: number,
  cropMargin: number = PRINT_CROP_MARGIN,
): boolean {
  return elementBoundsIntersectPrintCropZone(
    boundsCheckedForCrop(element),
    pageWidth,
    pageHeight,
    cropMargin,
  )
}

function elementBoundsIntersectPrintCropZone(
  element: PrintCropBoundsInput,
  pageWidth: number,
  pageHeight: number,
  cropMargin: number,
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

    return elementBoundsIntersectPrintCropZone(
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
