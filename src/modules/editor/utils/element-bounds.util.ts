import type { PageElement } from '../models'

export interface ElementBoundsRect {
  x: number
  y: number
  width: number
  height: number
}

const LINE_HIT_HEIGHT = 16

/** Axis-aligned box of a line in its own coordinates. The stroke is rotated around the
 * centre, the same way the canvas draws it, so a vertical rule is not measured as a
 * flat horizontal segment of height 0. */
export function shapeLineLocalBounds(element: {
  size: { width: number; height: number }
  rotation?: number
  strokeWidth?: number
}): ElementBoundsRect {
  const width = element.size.width
  const height = element.size.height
  const stroke = Math.max(element.strokeWidth ?? 1, 1)
  const theta = ((element.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const cx = width / 2
  const cy = height / 2
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    const dx = point.x - cx
    const dy = point.y - cy
    const x = cx + dx * cos - dy * sin
    const y = cy + dx * sin + dy * cos
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const pad = stroke / 2
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(maxX - minX + stroke, 1),
    height: Math.max(maxY - minY + stroke, 1),
  }
}

export function getElementSelectionBounds(element: PageElement): ElementBoundsRect {
  const { x, y } = element.position
  const { width, height } = element.size

  if (element.type === 'shape-line') {
    return {
      x,
      y: y - LINE_HIT_HEIGHT / 2,
      width: Math.max(width, 1),
      height: LINE_HIT_HEIGHT,
    }
  }

  return {
    x,
    y,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  }
}

export function isSelectableEditorElement(element: PageElement): boolean {
  return element.visible && !element.locked
}
