import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_FOLD_X,
  A4_SPREAD_PAGE_GAP,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  SPREAD_FOLD_LINE_DASH,
  SPREAD_FOLD_LINE_STROKE,
} from '../constants/page.constants'
import {
  buildPrintSafeZoneOverlay,
  type PrintSafeZoneOverlay,
} from './print-safe-zone.util'
import { buildGridLines, type GridLineConfig } from './snap.util'

export function isSpreadPageType(pageType: string | undefined): boolean {
  return pageType === 'SPREAD'
}

export function isSpreadCanvas(pageWidth: number, pageHeight: number): boolean {
  return pageWidth === A4_SPREAD_PAGE_WIDTH && pageHeight === A4_SPREAD_PAGE_HEIGHT
}

export function getSpreadVisualWidth(pageWidth: number, pageHeight: number): number {
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return pageWidth
  }

  return pageWidth + A4_SPREAD_PAGE_GAP
}

export function spreadLogicalXToVisual(
  x: number,
  pageWidth: number,
  pageHeight: number,
  elementWidth = 0,
): number {
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return x
  }

  const fold = A4_SPREAD_FOLD_X

  if (elementWidth > 0 && x < fold && x + elementWidth > fold) {
    return x
  }

  if (x >= fold) {
    return x + A4_SPREAD_PAGE_GAP
  }

  return x
}

export function spreadVisualXToLogical(
  x: number,
  pageWidth: number,
  pageHeight: number,
  elementWidth = 0,
): number {
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return x
  }

  const fold = A4_SPREAD_FOLD_X

  if (elementWidth > 0 && x < fold && x + elementWidth > fold) {
    return x
  }

  if (x >= fold + A4_SPREAD_PAGE_GAP) {
    return x - A4_SPREAD_PAGE_GAP
  }

  return x
}

/** Horizontal half-width of a rotated box — used to test crossing of the vertical fold. */
function getRotatedHalfExtentX(width: number, height: number, rotationDeg: number): number {
  if (!rotationDeg) {
    return width / 2
  }

  const rad = (rotationDeg * Math.PI) / 180
  return Math.abs((width / 2) * Math.cos(rad)) + Math.abs((height / 2) * Math.sin(rad))
}

export function elementSpansSpreadFold(
  element: {
    position: { x: number }
    size: { width: number; height: number }
    rotation?: number
  },
  pageWidth: number,
  pageHeight: number,
): boolean {
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return false
  }

  const centerX = element.position.x + element.size.width / 2
  const halfExtentX = getRotatedHalfExtentX(
    element.size.width,
    element.size.height,
    element.rotation ?? 0,
  )

  return centerX - halfExtentX < A4_SPREAD_FOLD_X && centerX + halfExtentX > A4_SPREAD_FOLD_X
}

/**
 * Generous clip extent so a rotated element is never cut before it reaches the fold.
 * The fold split relies on the clip being wider than the element in every direction.
 */
function getSpreadSplitClipExtent(size: { width: number; height: number }): number {
  return size.width + size.height + A4_SPREAD_PAGE_WIDTH
}

/**
 * Rotation for the split copies. The clip groups stay axis-aligned in page space so the
 * fold cut is always vertical; rotation is applied here, inside each clipped half.
 */
export function getSpreadSplitVisualsConfig(element: {
  size: { width: number; height: number }
  rotation?: number
}): {
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  rotation: number
} {
  const width = element.size.width
  const height = Math.max(element.size.height, 1)

  return {
    x: width / 2,
    y: height / 2,
    offsetX: width / 2,
    offsetY: height / 2,
    width,
    height,
    rotation: element.rotation ?? 0,
  }
}

export function getSpreadSplitLeftClipConfig(
  element: { position: { x: number; y: number }; size: { width: number; height: number } },
  pageHeight: number,
): { clip: { x: number; y: number; width: number; height: number } } {
  const foldLocal = A4_SPREAD_FOLD_X - element.position.x
  const extent = getSpreadSplitClipExtent(element.size)

  return {
    clip: {
      x: -extent,
      y: -element.position.y,
      width: foldLocal + extent,
      height: pageHeight,
    },
  }
}

export function getSpreadSplitRightClipConfig(
  element: { position: { x: number; y: number }; size: { width: number; height: number } },
  pageHeight: number,
): {
  x: number
  clip: { x: number; y: number; width: number; height: number }
} {
  const foldLocal = A4_SPREAD_FOLD_X - element.position.x
  const extent = getSpreadSplitClipExtent(element.size)

  return {
    x: A4_SPREAD_PAGE_GAP,
    clip: {
      x: foldLocal,
      y: -element.position.y,
      width: extent,
      height: pageHeight,
    },
  }
}

export interface SpreadPageSheet {
  key: 'left' | 'right'
  x: number
  width: number
  height: number
}

export function getSpreadPageSheets(pageHeight: number): SpreadPageSheet[] {
  return [
    { key: 'left', x: 0, width: A4_PAGE_WIDTH, height: pageHeight },
    {
      key: 'right',
      x: A4_PAGE_WIDTH + A4_SPREAD_PAGE_GAP,
      width: A4_PAGE_WIDTH,
      height: pageHeight,
    },
  ]
}

export type SpreadPageSide = 'left' | 'right'

export function getSpreadPageSide(
  x: number,
  pageWidth: number,
  pageHeight: number,
  elementWidth = 0,
): SpreadPageSide {
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return 'left'
  }

  const referenceX = x + elementWidth / 2
  return referenceX >= A4_SPREAD_FOLD_X ? 'right' : 'left'
}

export function getSpreadPageBounds(
  side: SpreadPageSide,
  pageHeight: number,
): { originX: number; width: number; height: number } {
  if (side === 'left') {
    return { originX: 0, width: A4_PAGE_WIDTH, height: pageHeight }
  }

  return { originX: A4_SPREAD_FOLD_X, width: A4_PAGE_WIDTH, height: pageHeight }
}

export function spreadGlobalXToPageLocal(globalX: number, side: SpreadPageSide): number {
  return globalX - (side === 'right' ? A4_SPREAD_FOLD_X : 0)
}

export function spreadPageLocalXToGlobal(localX: number, side: SpreadPageSide): number {
  return localX + (side === 'right' ? A4_SPREAD_FOLD_X : 0)
}

export function getSpreadPageVerticalGuideXs(
  side: SpreadPageSide,
  pageHeight: number,
): number[] {
  const { originX, width } = getSpreadPageBounds(side, pageHeight)

  return [originX, originX + width / 2, originX + width]
}

export function getSpreadPageSideLabel(side: SpreadPageSide): string {
  return side === 'left' ? 'левая страница' : 'правая страница'
}

export function getSpreadHorizontalGuideExtent(
  side: SpreadPageSide,
): { x1: number; x2: number } {
  if (side === 'left') {
    return { x1: 0, x2: A4_PAGE_WIDTH }
  }

  const rightOrigin = A4_PAGE_WIDTH + A4_SPREAD_PAGE_GAP
  return { x1: rightOrigin, x2: rightOrigin + A4_PAGE_WIDTH }
}

/** Page clip in element-local coordinates (content clipped, handles stay visible). */
export function getElementPageClipConfig(
  element: { position: { x: number; y: number }; size: { width: number } },
  pageWidth: number,
  pageHeight: number,
): {
  clip?: { x: number; y: number; width: number; height: number }
} {
  const clipTop = -element.position.y

  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return {
      clip: {
        x: -element.position.x,
        y: clipTop,
        width: pageWidth,
        height: pageHeight,
      },
    }
  }

  const side = getSpreadPageSide(
    element.position.x,
    pageWidth,
    pageHeight,
    element.size.width,
  )
  const bounds = getSpreadPageBounds(side, pageHeight)

  return {
    clip: {
      x: bounds.originX - element.position.x,
      y: clipTop,
      width: bounds.width,
      height: pageHeight,
    },
  }
}

/** @deprecated Use getElementPageClipConfig for spread-aware clipping. */
export function getElementPageClipRect(
  element: { position: { x: number; y: number }; size: { width: number } },
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const config = getElementPageClipConfig(element, pageWidth, pageHeight)

  return config.clip ?? { x: 0, y: 0, width: pageWidth, height: pageHeight }
}

function offsetGridLines(lines: GridLineConfig[], offsetX: number): GridLineConfig[] {
  return lines.map((line) => ({
    ...line,
    key: `offset-${offsetX}-${line.key}`,
    points: line.points.map((value, index) => (index % 2 === 0 ? value + offsetX : value)),
  }))
}

export function buildSpreadGridLines(pageHeight: number, gridSize: number): GridLineConfig[] {
  if (gridSize <= 0) {
    return []
  }

  const left = buildGridLines(A4_PAGE_WIDTH, pageHeight, gridSize)
  const right = offsetGridLines(
    buildGridLines(A4_PAGE_WIDTH, pageHeight, gridSize),
    A4_PAGE_WIDTH + A4_SPREAD_PAGE_GAP,
  )

  return [...left, ...right]
}

export function buildSpreadSheetShadowConfig(sheet: SpreadPageSheet, backgroundColor: string) {
  return {
    x: sheet.x,
    y: 0,
    width: sheet.width,
    height: sheet.height,
    fill: backgroundColor,
    listening: false,
    shadowColor: 'rgba(17, 17, 17, 0.12)',
    shadowBlur: 24,
    shadowOffsetX: 0,
    shadowOffsetY: 8,
    shadowOpacity: 0.35,
  }
}

export function buildSpreadSheetBackgroundConfig(sheet: SpreadPageSheet, backgroundColor: string) {
  return {
    name: sheet.key === 'left' ? 'page-background-left' : 'page-background-right',
    x: sheet.x,
    y: 0,
    width: sheet.width,
    height: sheet.height,
    fill: backgroundColor,
  }
}

export function buildSpreadFoldLineConfig(pageHeight: number) {
  return {
    points: [A4_SPREAD_FOLD_X, 0, A4_SPREAD_FOLD_X, pageHeight],
    stroke: SPREAD_FOLD_LINE_STROKE,
    strokeWidth: 1,
    dash: [...SPREAD_FOLD_LINE_DASH],
    listening: false,
  }
}

function offsetPrintOverlay(
  overlay: PrintSafeZoneOverlay,
  offsetX: number,
  side: 'left' | 'right',
): PrintSafeZoneOverlay {
  return {
    cropRects: overlay.cropRects.map((rect) => ({
      ...rect,
      key: `${side}-${rect.key}`,
      x: rect.x + offsetX,
    })),
    safeLines: overlay.safeLines.map((line) => ({
      ...line,
      key: `${side}-${line.key}`,
      points: line.points.map((value, index) =>
        index % 2 === 0 ? value + offsetX : value,
      ),
    })),
  }
}

export function buildSpreadPrintSafeZoneOverlay(
  cropMargin?: number,
  safeMargin?: number,
  highlightCrop = false,
): PrintSafeZoneOverlay {
  const leftOverlay = buildPrintSafeZoneOverlay(
    A4_PAGE_WIDTH,
    A4_PAGE_HEIGHT,
    cropMargin,
    safeMargin,
    highlightCrop,
  )
  const rightOverlay = offsetPrintOverlay(
    buildPrintSafeZoneOverlay(
      A4_PAGE_WIDTH,
      A4_PAGE_HEIGHT,
      cropMargin,
      safeMargin,
      highlightCrop,
    ),
    A4_SPREAD_FOLD_X + A4_SPREAD_PAGE_GAP,
    'right',
  )

  return {
    cropRects: [...leftOverlay.cropRects, ...rightOverlay.cropRects],
    safeLines: [...leftOverlay.safeLines, ...rightOverlay.safeLines],
  }
}

export function collectSpreadVerticalGuides(pageWidth: number): number[] {
  if (!isSpreadCanvas(pageWidth, A4_SPREAD_PAGE_HEIGHT)) {
    return [0, pageWidth / 2, pageWidth]
  }

  return [
    ...getSpreadPageVerticalGuideXs('left', A4_SPREAD_PAGE_HEIGHT),
    ...getSpreadPageVerticalGuideXs('right', A4_SPREAD_PAGE_HEIGHT),
  ]
}
