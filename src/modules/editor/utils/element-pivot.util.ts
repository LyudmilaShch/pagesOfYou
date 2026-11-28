import type Konva from 'konva'

export const ELEMENT_TRANSFORM_NODE_SUFFIX = '__transform'

export interface ElementPivotSize {
  width: number
  height: number
}

export function getElementTransformNodeId(elementId: string): string {
  return `${elementId}${ELEMENT_TRANSFORM_NODE_SUFFIX}`
}

export function resolveElementTransformNode(
  stage: Konva.Stage,
  elementId: string,
): Konva.Group | null {
  const outer = stage.findOne(`#${elementId}`) as Konva.Group | null

  if (!outer) {
    return null
  }

  return outer.findOne(`#${getElementTransformNodeId(elementId)}`) as Konva.Group | null
}

export function getElementPivotSize(
  width: number,
  height: number,
  minHeight = 1,
): ElementPivotSize {
  return {
    width,
    height: Math.max(height, minHeight),
  }
}

export function applyOuterTopLeftPosition(
  node: Konva.Group,
  topLeftX: number,
  topLeftY: number,
): void {
  node.position({ x: topLeftX, y: topLeftY })
}

export function readOuterTopLeft(node: Konva.Group): { x: number; y: number } {
  return {
    x: node.x(),
    y: node.y(),
  }
}

/**
 * Top-left after a resize. The transformer keeps the edge opposite the dragged
 * handle fixed by moving the center. The stored position is the top-left, so it
 * has to follow that center — otherwise a shrink from the left snaps the box
 * back to where it started.
 */
export function topLeftFromResizedCenter(
  center: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  }
}

export function syncInnerTransformNode(
  node: Konva.Group,
  size: ElementPivotSize,
  rotationDeg: number,
): void {
  node.scaleX(1)
  node.scaleY(1)
  node.width(size.width)
  node.height(size.height)
  node.offsetX(size.width / 2)
  node.offsetY(size.height / 2)
  node.position({ x: size.width / 2, y: size.height / 2 })
  node.rotation(rotationDeg)
}

export function prepareInnerNodeForTransformer(
  node: Konva.Group,
  size: ElementPivotSize,
): void {
  node.width(size.width)
  node.height(size.height)
  node.scaleX(1)
  node.scaleY(1)
  node.offsetX(size.width / 2)
  node.offsetY(size.height / 2)
  node.position({ x: size.width / 2, y: size.height / 2 })
}
