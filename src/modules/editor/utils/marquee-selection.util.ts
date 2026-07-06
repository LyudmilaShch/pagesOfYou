import type Konva from 'konva'

export interface PagePointer {
  x: number
  y: number
}

export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export function stagePointerToPageCoords(
  stage: Konva.Stage,
  pageGroup: Konva.Group,
): PagePointer | null {
  const pointer = stage.getPointerPosition()
  if (!pointer) {
    return null
  }

  const transform = pageGroup.getAbsoluteTransform().copy().invert()
  return transform.point(pointer)
}

export function normalizeRect(start: PagePointer, end: PagePointer): NormalizedRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  return { x, y, width, height }
}

export const MARQUEE_MIN_SIZE = 4

export function isMarqueeLargeEnough(rect: NormalizedRect): boolean {
  return rect.width >= MARQUEE_MIN_SIZE || rect.height >= MARQUEE_MIN_SIZE
}
