import type { LeafElement, PageElement, PageElementType } from '../models'
import { isGroupElement } from '../models'
import type { GroupElement } from '../models/group-element.model'
import type { Position, Size } from '../models/geometry.model'

/** Pure tree helpers over the nested `PageElement[]` structure. No Vue/Konva dependency —
 * ported near-verbatim to the backend, which has no Konva to lean on. */

export interface TreeLocation {
  node: PageElement
  /** The actual array owning `node` (root array or a group's `children`) — mutate it in place. */
  siblings: PageElement[]
  index: number
  parent: GroupElement | null
}

function locateIn(nodes: PageElement[], id: string, parent: GroupElement | null): TreeLocation | null {
  const index = nodes.findIndex((node) => node.id === id)
  if (index !== -1) {
    return { node: nodes[index], siblings: nodes, index, parent }
  }

  for (const node of nodes) {
    if (isGroupElement(node)) {
      const found = locateIn(node.children, id, node)
      if (found) {
        return found
      }
    }
  }

  return null
}

export function locateNode(root: PageElement[], id: string): TreeLocation | null {
  return locateIn(root, id, null)
}

export function findNodeById(root: PageElement[], id: string): PageElement | null {
  return locateNode(root, id)?.node ?? null
}

export function getParentOf(root: PageElement[], id: string): GroupElement | null {
  return locateNode(root, id)?.parent ?? null
}

export function getSiblings(root: PageElement[], id: string): PageElement[] {
  return locateNode(root, id)?.siblings ?? []
}

/** Root-first list of group ancestors (not including the node itself). */
export function getAncestors(root: PageElement[], id: string): GroupElement[] {
  function search(nodes: PageElement[], path: GroupElement[]): GroupElement[] | null {
    for (const node of nodes) {
      if (node.id === id) {
        return path
      }

      if (isGroupElement(node)) {
        const found = search(node.children, [...path, node])
        if (found) {
          return found
        }
      }
    }

    return null
  }

  return search(root, []) ?? []
}

/** Root-first ancestors + the node itself. */
export function getPath(root: PageElement[], id: string): PageElement[] {
  const node = findNodeById(root, id)
  if (!node) {
    return []
  }

  return [...getAncestors(root, id), node]
}

export function getDescendants(node: PageElement): PageElement[] {
  if (!isGroupElement(node)) {
    return []
  }

  const result: PageElement[] = []
  for (const child of node.children) {
    result.push(child)
    result.push(...getDescendants(child))
  }

  return result
}

export function countDescendants(node: PageElement): number {
  return getDescendants(node).length
}

/** Recurse into `group.children`, mapping only leaf nodes — used by normalization/migration. */
export function mapTree(nodes: PageElement[], mapLeaf: (leaf: LeafElement) => LeafElement): PageElement[] {
  return nodes.map((node) => {
    if (isGroupElement(node)) {
      return { ...node, children: mapTree(node.children, mapLeaf) }
    }

    return mapLeaf(node as LeafElement)
  })
}

export function walkTree(nodes: PageElement[], visit: (node: PageElement) => void): void {
  for (const node of nodes) {
    visit(node)
    if (isGroupElement(node)) {
      walkTree(node.children, visit)
    }
  }
}

let elementIdCounter = 0

export function generateElementId(type: PageElementType): string {
  elementIdCounter += 1
  return `${type}-${Date.now()}-${elementIdCounter}`
}

/** Deep clone with a fresh id for the node and every descendant. */
export function cloneSubtree(
  node: PageElement,
  generateId: (type: PageElementType) => string = generateElementId,
): PageElement {
  const clone = JSON.parse(JSON.stringify(node)) as PageElement

  function remap(current: PageElement): PageElement {
    current.id = generateId(current.type)
    if (isGroupElement(current)) {
      current.children = current.children.map(remap)
    }
    return current
  }

  return remap(clone)
}

/** Leaves only, in paint order (depth-first, preorder), with ABSOLUTE page coordinates.
 *
 * `positionOverrides` (keyed by node id, e.g. live-drag positions) substitute a node's stored
 * LOCAL position during composition — a plain "replace with this value and treat as absolute"
 * overlay would be wrong for a nested node (its live position is parent-relative, not a page
 * coordinate), so the override is composed through the same ancestor chain as everything else. */
export function flattenTree(
  nodes: PageElement[],
  positionOverrides?: Record<string, Position>,
): LeafElement[] {
  const result: LeafElement[] = []

  function walk(list: PageElement[], parentFrame: AbsoluteBox): void {
    for (const node of list) {
      const localPosition = positionOverrides?.[node.id] ?? node.position
      const box = childBoxFromLocal({ position: localPosition, rotation: node.rotation }, parentFrame)

      if (isGroupElement(node)) {
        walk(node.children, contentFrameOf(box, node.size))
      } else {
        result.push({ ...(node as LeafElement), position: { x: box.x, y: box.y }, rotation: box.rotationDeg })
      }
    }
  }

  walk(nodes, ROOT_FRAME)
  return result
}

// ---------------------------------------------------------------------------
// Rigid 2D transform composition (translate + rotate around center pivot).
// Mirrors the existing two-level Konva structure per element: an outer group
// carrying `position` (no rotation), and an inner "transform" group rotating
// around the element's own center (offsetX/offsetY = size/2). No persistent
// scale is ever carried — every resize is baked back into stored size/position
// immediately, so composition never needs to track a scale factor at rest.
// ---------------------------------------------------------------------------

export interface AbsoluteBox {
  /** Absolute top-left of the node's own (unrotated) bounding box. */
  x: number
  y: number
  /** Absolute rotation, in degrees. */
  rotationDeg: number
}

export const ROOT_FRAME: AbsoluteBox = { x: 0, y: 0, rotationDeg: 0 }

function rotateVector(vx: number, vy: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: vx * cos - vy * sin, y: vx * sin + vy * cos }
}

/** The node's own absolute box, given the parent's content frame and the node's local position/rotation. */
export function childBoxFromLocal(
  local: { position: Position; rotation: number },
  parentContentFrame: AbsoluteBox,
): AbsoluteBox {
  const rotated = rotateVector(local.position.x, local.position.y, parentContentFrame.rotationDeg)
  return {
    x: parentContentFrame.x + rotated.x,
    y: parentContentFrame.y + rotated.y,
    rotationDeg: parentContentFrame.rotationDeg + local.rotation,
  }
}

/** The absolute frame a node's OWN CHILDREN's `position`/`rotation` are relative to. */
export function contentFrameOf(box: AbsoluteBox, size: Size): AbsoluteBox {
  const halfX = size.width / 2
  const halfY = size.height / 2
  const rotatedHalf = rotateVector(halfX, halfY, box.rotationDeg)
  return {
    x: box.x + halfX - rotatedHalf.x,
    y: box.y + halfY - rotatedHalf.y,
    rotationDeg: box.rotationDeg,
  }
}

/** The absolute content frame of a given container (or the page root when `parentId` is null). */
export function getContentFrameOf(root: PageElement[], parentId: string | null): AbsoluteBox {
  if (parentId == null) {
    return ROOT_FRAME
  }

  const parent = findNodeById(root, parentId)
  if (!parent) {
    return ROOT_FRAME
  }

  const parentBox = getAbsoluteTransform(root, parentId)
  return contentFrameOf(parentBox, parent.size)
}

/** A node's absolute box (top-left + rotation), composed through the full ancestor chain. */
export function getAbsoluteTransform(root: PageElement[], id: string): AbsoluteBox {
  const path = getPath(root, id)
  let frame: AbsoluteBox = ROOT_FRAME
  let box: AbsoluteBox = frame

  for (const node of path) {
    box = childBoxFromLocal(node, frame)
    frame = contentFrameOf(box, node.size)
  }

  return box
}

/** Local (position, rotation) → absolute box, given the target parent's absolute content frame. */
export function localToAbsolute(
  local: { position: Position; rotation: number },
  parentContentFrame: AbsoluteBox,
): AbsoluteBox {
  return childBoxFromLocal(local, parentContentFrame)
}

/** Absolute box → local (position, rotation), given the target parent's absolute content frame. */
export function absoluteToLocal(
  absolute: AbsoluteBox,
  parentContentFrame: AbsoluteBox,
): { position: Position; rotation: number } {
  const dx = absolute.x - parentContentFrame.x
  const dy = absolute.y - parentContentFrame.y
  const local = rotateVector(dx, dy, -parentContentFrame.rotationDeg)

  return {
    position: { x: local.x, y: local.y },
    rotation: absolute.rotationDeg - parentContentFrame.rotationDeg,
  }
}

export interface ElementBoundsRect {
  x: number
  y: number
  width: number
  height: number
}

/** Axis-aligned absolute bounds (rotation ignored, matching the existing flat selection-bounds behavior).
 * For a group, this is the union bbox of all descendant leaves. */
export function getElementAbsoluteBounds(root: PageElement[], id: string): ElementBoundsRect {
  const node = findNodeById(root, id)
  if (!node) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const box = getAbsoluteTransform(root, id)

  if (!isGroupElement(node)) {
    return { x: box.x, y: box.y, width: Math.max(node.size.width, 1), height: Math.max(node.size.height, 1) }
  }

  const leaves = getDescendants(node).filter((descendant) => !isGroupElement(descendant))
  if (leaves.length === 0) {
    return { x: box.x, y: box.y, width: node.size.width, height: node.size.height }
  }

  const rects = leaves.map((leaf) => {
    const leafBox = getAbsoluteTransform(root, leaf.id)
    return { x: leafBox.x, y: leafBox.y, width: Math.max(leaf.size.width, 1), height: Math.max(leaf.size.height, 1) }
  })

  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
