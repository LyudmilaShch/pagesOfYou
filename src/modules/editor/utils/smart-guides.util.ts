import type { PageElement } from '../models'
import {
  getSpreadHorizontalGuideExtent,
  getSpreadPageSide,
  getSpreadPageVerticalGuideXs,
  getSpreadVisualWidth,
  isSpreadCanvas,
  spreadLogicalXToVisual,
  type SpreadPageSide,
} from './spread.util'

export const SMART_GUIDE_THRESHOLD = 5
export const SMART_GUIDE_STROKE = '#111111'

export interface SmartGuideLines {
  vertical: number[]
  horizontal: number[]
  spreadSide?: SpreadPageSide | null
}

export interface SmartGuidesSnapResult {
  x: number
  y: number
  snappedX: boolean
  snappedY: boolean
  verticalGuides: number[]
  horizontalGuides: number[]
  spreadSide: SpreadPageSide | null
}

interface AxisSnapResult {
  position: number
  snapped: boolean
  activeGuides: number[]
}

function isSameSpreadPageSide(
  element: PageElement,
  side: SpreadPageSide,
  pageWidth: number,
  pageHeight: number,
): boolean {
  return (
    getSpreadPageSide(element.position.x, pageWidth, pageHeight, element.size.width) === side
  )
}

function collectVerticalGuides(
  pageWidth: number,
  pageHeight: number,
  otherElements: PageElement[],
  excludeId: string,
  elementX: number,
  elementWidth: number,
): number[] {
  if (isSpreadCanvas(pageWidth, pageHeight)) {
    const side = getSpreadPageSide(elementX, pageWidth, pageHeight, elementWidth)
    const guides = new Set(getSpreadPageVerticalGuideXs(side, pageHeight))

    for (const element of otherElements) {
      if (element.id === excludeId || !element.visible) {
        continue
      }

      if (!isSameSpreadPageSide(element, side, pageWidth, pageHeight)) {
        continue
      }

      const { x } = element.position
      const { width } = element.size
      guides.add(x)
      guides.add(x + width / 2)
      guides.add(x + width)
    }

    return [...guides]
  }

  const guides = new Set<number>([0, pageWidth / 2, pageWidth])

  for (const element of otherElements) {
    if (element.id === excludeId || !element.visible) {
      continue
    }

    const { x } = element.position
    const { width } = element.size
    guides.add(x)
    guides.add(x + width / 2)
    guides.add(x + width)
  }

  return [...guides]
}

function collectHorizontalGuides(
  pageHeight: number,
  otherElements: PageElement[],
  excludeId: string,
  pageWidth: number,
  elementX: number,
  elementWidth: number,
): number[] {
  const guides = new Set<number>([0, pageHeight / 2, pageHeight])

  for (const element of otherElements) {
    if (element.id === excludeId || !element.visible) {
      continue
    }

    if (
      isSpreadCanvas(pageWidth, pageHeight) &&
      !isSameSpreadPageSide(
        element,
        getSpreadPageSide(elementX, pageWidth, pageHeight, elementWidth),
        pageWidth,
        pageHeight,
      )
    ) {
      continue
    }

    const { y } = element.position
    const { height } = element.size
    guides.add(y)
    guides.add(y + height / 2)
    guides.add(y + height)
  }

  return [...guides]
}

function snapToAxisGuides(
  position: number,
  size: number,
  guideValues: number[],
  threshold: number,
): AxisSnapResult {
  const anchors = [
    { edge: position, offset: 0 },
    { edge: position + size / 2, offset: size / 2 },
    { edge: position + size, offset: size },
  ]

  let bestDiff = threshold + 1
  let bestPosition = position

  for (const guide of guideValues) {
    for (const anchor of anchors) {
      const diff = Math.abs(anchor.edge - guide)
      if (diff <= threshold && diff < bestDiff) {
        bestDiff = diff
        bestPosition = guide - anchor.offset
      }
    }
  }

  if (bestDiff > threshold) {
    return { position, snapped: false, activeGuides: [] }
  }

  const left = bestPosition
  const center = bestPosition + size / 2
  const right = bestPosition + size

  const activeGuides = guideValues.filter(
    (guide) =>
      Math.abs(left - guide) <= threshold ||
      Math.abs(center - guide) <= threshold ||
      Math.abs(right - guide) <= threshold,
  )

  return {
    position: bestPosition,
    snapped: true,
    activeGuides: [...new Set(activeGuides)],
  }
}

export function computeSmartGuidesSnap(input: {
  x: number
  y: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
  otherElements: PageElement[]
  excludeId: string
  threshold?: number
}): SmartGuidesSnapResult {
  const threshold = input.threshold ?? SMART_GUIDE_THRESHOLD

  const verticalGuideValues = collectVerticalGuides(
    input.pageWidth,
    input.pageHeight,
    input.otherElements,
    input.excludeId,
    input.x,
    input.width,
  )
  const horizontalGuideValues = collectHorizontalGuides(
    input.pageHeight,
    input.otherElements,
    input.excludeId,
    input.pageWidth,
    input.x,
    input.width,
  )

  const verticalSnap = snapToAxisGuides(input.x, input.width, verticalGuideValues, threshold)
  const horizontalSnap = snapToAxisGuides(input.y, input.height, horizontalGuideValues, threshold)

  const spreadSide = isSpreadCanvas(input.pageWidth, input.pageHeight)
    ? getSpreadPageSide(verticalSnap.position, input.pageWidth, input.pageHeight, input.width)
    : null

  return {
    x: verticalSnap.position,
    y: horizontalSnap.position,
    snappedX: verticalSnap.snapped,
    snappedY: horizontalSnap.snapped,
    verticalGuides: verticalSnap.activeGuides,
    horizontalGuides: horizontalSnap.activeGuides,
    spreadSide,
  }
}

export function buildSmartGuideLineConfigs(
  guides: SmartGuideLines,
  pageWidth: number,
  pageHeight: number,
): Array<{ key: string; points: number[] }> {
  const lines: Array<{ key: string; points: number[] }> = []
  const layoutWidth = getSpreadVisualWidth(pageWidth, pageHeight)
  const horizontalExtent =
    isSpreadCanvas(pageWidth, pageHeight) && guides.spreadSide
      ? getSpreadHorizontalGuideExtent(guides.spreadSide)
      : { x1: 0, x2: layoutWidth }

  for (const x of guides.vertical) {
    const visualX = spreadLogicalXToVisual(x, pageWidth, pageHeight)

    lines.push({
      key: `guide-v-${x}`,
      points: [visualX, 0, visualX, pageHeight],
    })
  }

  for (const y of guides.horizontal) {
    lines.push({
      key: `guide-h-${y}`,
      points: [horizontalExtent.x1, y, horizontalExtent.x2, y],
    })
  }

  return lines
}
