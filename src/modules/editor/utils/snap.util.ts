import type { Position } from '../models/geometry.model'
import { isSpreadCanvas, getSpreadPageBounds, getSpreadPageSide } from './spread.util'

export const DEFAULT_SNAP_GRID_SIZE = 10

export function snapCoordinate(value: number, gridSize: number): number {
  if (gridSize <= 0) {
    return value
  }

  return Math.round(value / gridSize) * gridSize
}

export function snapPosition(position: Position, gridSize: number): Position {
  return {
    x: snapCoordinate(position.x, gridSize),
    y: snapCoordinate(position.y, gridSize),
  }
}

export function getPageCenterPosition(
  pageWidth: number,
  pageHeight: number,
  elementWidth: number,
  elementHeight: number,
  axis: 'horizontal' | 'vertical' | 'both',
  current: Position,
): Position {
  let x = current.x
  let y = current.y

  if (isSpreadCanvas(pageWidth, pageHeight)) {
    const side = getSpreadPageSide(current.x, pageWidth, pageHeight, elementWidth)
    const bounds = getSpreadPageBounds(side, pageHeight)

    if (axis === 'horizontal' || axis === 'both') {
      x = bounds.originX + (bounds.width - elementWidth) / 2
    }

    if (axis === 'vertical' || axis === 'both') {
      y = (pageHeight - elementHeight) / 2
    }

    return { x, y }
  }

  if (axis === 'horizontal' || axis === 'both') {
    x = (pageWidth - elementWidth) / 2
  }

  if (axis === 'vertical' || axis === 'both') {
    y = (pageHeight - elementHeight) / 2
  }

  return { x, y }
}

export interface GridLineConfig {
  key: string
  points: number[]
  stroke: string
  strokeWidth: number
}

export function buildGridLines(
  pageWidth: number,
  pageHeight: number,
  gridSize: number,
): GridLineConfig[] {
  if (gridSize <= 0) {
    return []
  }

  const lines: GridLineConfig[] = []
  const majorStep = gridSize * 5

  for (let x = 0; x <= pageWidth; x += gridSize) {
    const isMajor = x % majorStep === 0
    lines.push({
      key: `v-${x}`,
      points: [x, 0, x, pageHeight],
      stroke: isMajor ? 'rgba(17, 17, 17, 0.14)' : 'rgba(17, 17, 17, 0.07)',
      strokeWidth: isMajor ? 0.75 : 0.5,
    })
  }

  for (let y = 0; y <= pageHeight; y += gridSize) {
    const isMajor = y % majorStep === 0
    lines.push({
      key: `h-${y}`,
      points: [0, y, pageWidth, y],
      stroke: isMajor ? 'rgba(17, 17, 17, 0.14)' : 'rgba(17, 17, 17, 0.07)',
      strokeWidth: isMajor ? 0.75 : 0.5,
    })
  }

  return lines
}
