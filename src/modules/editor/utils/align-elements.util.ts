import type { PageElement } from '../models'
import { alignmentLocalBounds } from './selection-outline.util'
import { getSpreadPageBounds, getSpreadPageSide, isSpreadCanvas } from './spread.util'

export type MultiAlignMode =
  | 'left'
  | 'top'
  | 'right'
  | 'bottom'
  | 'center-horizontal'
  | 'center-vertical'
  | 'distribute-horizontal'
  | 'distribute-vertical'

export interface ElementPositionPatch {
  x?: number
  y?: number
}

/** Where the element actually paints. A contents row keeps its stored box while the title,
 * the page number and the line sit outside it; aligning that box pins the empty origin and
 * pushes the words off the page. */
function layoutBox(element: PageElement): {
  x: number
  y: number
  width: number
  height: number
  localX: number
  localY: number
} {
  const local = alignmentLocalBounds(element)

  return {
    x: element.position.x + local.x,
    y: element.position.y + local.y,
    width: local.width,
    height: local.height,
    localX: local.x,
    localY: local.y,
  }
}

export function getElementBounds(element: PageElement): {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
} {
  const box = layoutBox(element)

  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
  }
}

export function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function computeMultiElementAlignment(
  elements: PageElement[],
  mode: MultiAlignMode,
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()

  if (elements.length < 2) {
    return patches
  }

  switch (mode) {
    case 'left': {
      const target = Math.min(...elements.map((element) => element.position.x))
      for (const element of elements) {
        patches.set(element.id, { x: target })
      }
      break
    }

    case 'top': {
      const target = Math.min(...elements.map((element) => element.position.y))
      for (const element of elements) {
        patches.set(element.id, { y: target })
      }
      break
    }

    case 'right': {
      const target = Math.max(...elements.map((element) => element.position.x + element.size.width))
      for (const element of elements) {
        patches.set(element.id, { x: target - element.size.width })
      }
      break
    }

    case 'bottom': {
      const target = Math.max(...elements.map((element) => element.position.y + element.size.height))
      for (const element of elements) {
        patches.set(element.id, { y: target - element.size.height })
      }
      break
    }

    case 'center-horizontal': {
      const bounds = elements.map(getElementBounds)
      const minLeft = Math.min(...bounds.map((item) => item.left))
      const maxRight = Math.max(...bounds.map((item) => item.right))
      const targetCenter = (minLeft + maxRight) / 2

      for (const element of elements) {
        patches.set(element.id, { x: targetCenter - element.size.width / 2 })
      }
      break
    }

    case 'center-vertical': {
      const bounds = elements.map(getElementBounds)
      const minTop = Math.min(...bounds.map((item) => item.top))
      const maxBottom = Math.max(...bounds.map((item) => item.bottom))
      const targetCenter = (minTop + maxBottom) / 2

      for (const element of elements) {
        patches.set(element.id, { y: targetCenter - element.size.height / 2 })
      }
      break
    }

    case 'distribute-horizontal': {
      if (elements.length < 3) {
        return patches
      }

      const sorted = [...elements].sort((a, b) => a.position.x - b.position.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const span = last.position.x + last.size.width - first.position.x
      const totalWidth = sorted.reduce((sum, element) => sum + element.size.width, 0)
      const gap = (span - totalWidth) / (sorted.length - 1)

      let currentX = first.position.x
      patches.set(first.id, { x: first.position.x })

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1]
        currentX = (patches.get(previous.id)?.x ?? previous.position.x) + previous.size.width + gap
        patches.set(sorted[index].id, { x: currentX })
      }
      break
    }

    case 'distribute-vertical': {
      if (elements.length < 3) {
        return patches
      }

      const sorted = [...elements].sort((a, b) => a.position.y - b.position.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const span = last.position.y + last.size.height - first.position.y
      const totalHeight = sorted.reduce((sum, element) => sum + element.size.height, 0)
      const gap = (span - totalHeight) / (sorted.length - 1)

      let currentY = first.position.y
      patches.set(first.id, { y: first.position.y })

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1]
        currentY = (patches.get(previous.id)?.y ?? previous.position.y) + previous.size.height + gap
        patches.set(sorted[index].id, { y: currentY })
      }
      break
    }
  }

  return patches
}

export interface GapSegment {
  id: string
  value: number
  midX: number
  midY: number
}

function sortByHorizontalOrder(elements: PageElement[]): PageElement[] {
  return [...elements].sort((a, b) => {
    if (a.position.x !== b.position.x) {
      return a.position.x - b.position.x
    }

    return a.position.y - b.position.y
  })
}

function sortByVerticalOrder(elements: PageElement[]): PageElement[] {
  return [...elements].sort((a, b) => {
    if (a.position.y !== b.position.y) {
      return a.position.y - b.position.y
    }

    return a.position.x - b.position.x
  })
}

export function computeHorizontalGapSegments(elements: PageElement[]): GapSegment[] {
  if (elements.length < 2) {
    return []
  }

  const sorted = sortByHorizontalOrder(elements)
  const segments: GapSegment[] = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    const value = next.position.x - (current.position.x + current.size.width)
    const midX = current.position.x + current.size.width + value / 2
    const midY =
      (current.position.y + current.size.height / 2 + next.position.y + next.size.height / 2) / 2

    segments.push({
      id: `${current.id}-${next.id}-h`,
      value,
      midX,
      midY,
    })
  }

  return segments
}

export function computeVerticalGapSegments(elements: PageElement[]): GapSegment[] {
  if (elements.length < 2) {
    return []
  }

  const sorted = sortByVerticalOrder(elements)
  const segments: GapSegment[] = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    const value = next.position.y - (current.position.y + current.size.height)
    const midY = current.position.y + current.size.height + value / 2
    const midX =
      (current.position.x + current.size.width / 2 + next.position.x + next.size.width / 2) / 2

    segments.push({
      id: `${current.id}-${next.id}-v`,
      value,
      midX,
      midY,
    })
  }

  return segments
}

export function getAverageHorizontalGap(elements: PageElement[]): number | null {
  const segments = computeHorizontalGapSegments(elements)
  if (segments.length === 0) {
    return null
  }

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return Math.round(total / segments.length)
}

export function getAverageVerticalGap(elements: PageElement[]): number | null {
  const segments = computeVerticalGapSegments(elements)
  if (segments.length === 0) {
    return null
  }

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return Math.round(total / segments.length)
}

export function distributeWithFixedHorizontalGap(
  elements: PageElement[],
  gap: number,
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()
  const sorted = sortByHorizontalOrder(elements)

  if (sorted.length < 2) {
    return patches
  }

  patches.set(sorted[0].id, { x: sorted[0].position.x })

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const previousX = patches.get(previous.id)?.x ?? previous.position.x
    patches.set(sorted[index].id, { x: previousX + previous.size.width + gap })
  }

  return patches
}

export function distributeWithFixedVerticalGap(
  elements: PageElement[],
  gap: number,
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()
  const sorted = sortByVerticalOrder(elements)

  if (sorted.length < 2) {
    return patches
  }

  patches.set(sorted[0].id, { y: sorted[0].position.y })

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const previousY = patches.get(previous.id)?.y ?? previous.position.y
    patches.set(sorted[index].id, { y: previousY + previous.size.height + gap })
  }

  return patches
}

/** Rectangle the layout commands place elements into. Page, one half of a spread, or a group. */
export interface LayoutFrame {
  x: number
  y: number
  width: number
  height: number
}

export type LayoutFrameTarget = 'page' | 'spread'

export interface SelectionLayoutOptions {
  target: LayoutFrameTarget
  safeMargin: boolean
}

export type FrameAlignMode =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'center-horizontal'
  | 'center-vertical'

export interface LayoutGroup {
  frame: LayoutFrame
  elements: PageElement[]
}

export interface ResolveLayoutGroupsOptions {
  pageWidth: number
  pageHeight: number
  target: LayoutFrameTarget
  /** Inset from each edge of the frame. 0 keeps the full frame. A margin that would erase the frame is ignored. */
  safeMargin: number
  /** Set while editing inside a group: every element shares this local box, and the page split is skipped. */
  localFrame?: LayoutFrame | null
}

export function getSelectionBounds(elements: PageElement[]): {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
} {
  const bounds = elements.map(getElementBounds)
  const left = Math.min(...bounds.map((item) => item.left))
  const top = Math.min(...bounds.map((item) => item.top))
  const right = Math.max(...bounds.map((item) => item.right))
  const bottom = Math.max(...bounds.map((item) => item.bottom))

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

export function insetLayoutFrame(frame: LayoutFrame, margin: number): LayoutFrame {
  if (margin <= 0) {
    return frame
  }

  const width = frame.width - margin * 2
  const height = frame.height - margin * 2
  if (width <= 0 || height <= 0) {
    return frame
  }

  return {
    x: frame.x + margin,
    y: frame.y + margin,
    width,
    height,
  }
}

/**
 * One frame for a plain page or a whole spread. On a spread with target "page", elements are
 * split by the page their center sits on, and each half is laid out on its own.
 */
export function resolveLayoutGroups(
  elements: PageElement[],
  options: ResolveLayoutGroupsOptions,
): LayoutGroup[] {
  if (elements.length === 0) {
    return []
  }

  if (options.localFrame) {
    return [{ frame: options.localFrame, elements }]
  }

  const fullPage: LayoutFrame = {
    x: 0,
    y: 0,
    width: options.pageWidth,
    height: options.pageHeight,
  }

  if (!isSpreadCanvas(options.pageWidth, options.pageHeight) || options.target === 'spread') {
    return [{ frame: insetLayoutFrame(fullPage, options.safeMargin), elements }]
  }

  const left: PageElement[] = []
  const right: PageElement[] = []

  for (const element of elements) {
    const box = layoutBox(element)
    const side = getSpreadPageSide(
      box.x,
      options.pageWidth,
      options.pageHeight,
      box.width,
    )
    if (side === 'right') {
      right.push(element)
    } else {
      left.push(element)
    }
  }

  const groups: LayoutGroup[] = []

  if (left.length > 0) {
    const bounds = getSpreadPageBounds('left', options.pageHeight)
    groups.push({
      frame: insetLayoutFrame(
        { x: bounds.originX, y: 0, width: bounds.width, height: bounds.height },
        options.safeMargin,
      ),
      elements: left,
    })
  }

  if (right.length > 0) {
    const bounds = getSpreadPageBounds('right', options.pageHeight)
    groups.push({
      frame: insetLayoutFrame(
        { x: bounds.originX, y: 0, width: bounds.width, height: bounds.height },
        options.safeMargin,
      ),
      elements: right,
    })
  }

  return groups
}

type AxisPlacement = 'start' | 'end' | 'center'

function shiftToPlacement(
  start: number,
  size: number,
  frameStart: number,
  frameSize: number,
  placement: AxisPlacement,
): number {
  if (size > frameSize) {
    return frameStart - start
  }

  if (placement === 'start') {
    return frameStart - start
  }

  if (placement === 'end') {
    return frameStart + frameSize - (start + size)
  }

  return frameStart + (frameSize - size) / 2 - start
}

/**
 * Moves the selection as one block. Gaps between elements stay as they are.
 * A block larger than the frame on an axis stays pinned to the start of that axis.
 */
export function alignGroupToFrame(
  elements: PageElement[],
  frame: LayoutFrame,
  mode: FrameAlignMode,
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()

  if (elements.length === 0) {
    return patches
  }

  const bounds = getSelectionBounds(elements)
  const horizontal: AxisPlacement | null =
    mode === 'left' ? 'start' : mode === 'right' ? 'end' : mode === 'center-horizontal' ? 'center' : null
  const vertical: AxisPlacement | null =
    mode === 'top' ? 'start' : mode === 'bottom' ? 'end' : mode === 'center-vertical' ? 'center' : null

  const dx =
    horizontal == null
      ? 0
      : Math.round(shiftToPlacement(bounds.left, bounds.width, frame.x, frame.width, horizontal))
  const dy =
    vertical == null
      ? 0
      : Math.round(shiftToPlacement(bounds.top, bounds.height, frame.y, frame.height, vertical))

  if (dx === 0 && dy === 0) {
    return patches
  }

  for (const element of elements) {
    const patch: ElementPositionPatch = {}
    if (dx !== 0) {
      patch.x = element.position.x + dx
    }
    if (dy !== 0) {
      patch.y = element.position.y + dy
    }
    patches.set(element.id, patch)
  }

  return patches
}

function sortByVisualHorizontal(elements: PageElement[]): PageElement[] {
  return [...elements].sort((a, b) => {
    const left = layoutBox(a).x - layoutBox(b).x
    if (left !== 0) {
      return left
    }
    return layoutBox(a).y - layoutBox(b).y
  })
}

function sortByVisualVertical(elements: PageElement[]): PageElement[] {
  return [...elements].sort((a, b) => {
    const top = layoutBox(a).y - layoutBox(b).y
    if (top !== 0) {
      return top
    }
    return layoutBox(a).x - layoutBox(b).x
  })
}

function axisValue(element: PageElement, axis: 'horizontal' | 'vertical'): number {
  const box = layoutBox(element)
  return axis === 'horizontal' ? box.x : box.y
}

function axisSize(element: PageElement, axis: 'horizontal' | 'vertical'): number {
  const box = layoutBox(element)
  return axis === 'horizontal' ? box.width : box.height
}

/** `visual` is where the painted edge should sit. The stored position is that edge minus the
 * offset of the words inside the element. */
function positionForVisualEdge(
  element: PageElement,
  axis: 'horizontal' | 'vertical',
  visual: number,
): number {
  const box = layoutBox(element)
  return Math.round(visual - (axis === 'horizontal' ? box.localX : box.localY))
}

/**
 * Equal gaps inside the frame. The first and last elements sit on the frame edges.
 * From 2 elements. When the elements are wider than the frame together, the gap is negative:
 * neighbours overlap, and the outer edges stay on the frame. Sizes are not changed, so a single
 * element wider than the frame still sticks out.
 */
export function distributeInFrame(
  elements: PageElement[],
  frame: LayoutFrame,
  axis: 'horizontal' | 'vertical',
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()

  if (elements.length < 2) {
    return patches
  }

  const sorted =
    axis === 'horizontal' ? sortByVisualHorizontal(elements) : sortByVisualVertical(elements)
  const frameStart = axis === 'horizontal' ? frame.x : frame.y
  const frameSize = axis === 'horizontal' ? frame.width : frame.height
  const sizes = sorted.map((element) => axisSize(element, axis))
  const totalSize = sizes.reduce((sum, size) => sum + size, 0)
  const gap = (frameSize - totalSize) / (sorted.length - 1)
  const positions: number[] = []

  let cursor = frameStart
  for (let index = 0; index < sorted.length - 1; index += 1) {
    positions.push(Math.round(cursor))
    cursor += sizes[index] + gap
  }
  positions.push(Math.round(frameStart + frameSize - sizes[sizes.length - 1]))

  sorted.forEach((element, index) => {
    const next = positionForVisualEdge(element, axis, positions[index])
    const current = axis === 'horizontal' ? element.position.x : element.position.y
    if (next === current) {
      return
    }

    patches.set(element.id, axis === 'horizontal' ? { x: next } : { y: next })
  })

  return patches
}

/**
 * Packs elements with a fixed gap, in their current order along the axis, and centers that
 * block in the frame. A block that does not fit stays pinned to the start of the frame.
 */
export function packAndCenterInFrame(
  elements: PageElement[],
  frame: LayoutFrame,
  axis: 'horizontal' | 'vertical',
  gap: number,
): Map<string, ElementPositionPatch> {
  const patches = new Map<string, ElementPositionPatch>()

  if (elements.length < 2 || !Number.isFinite(gap)) {
    return patches
  }

  const sorted =
    axis === 'horizontal' ? sortByVisualHorizontal(elements) : sortByVisualVertical(elements)
  const frameStart = axis === 'horizontal' ? frame.x : frame.y
  const frameSize = axis === 'horizontal' ? frame.width : frame.height
  const sizes = sorted.map((element) => axisSize(element, axis))
  const totalSize = sizes.reduce((sum, size) => sum + size, 0)
  const block = totalSize + gap * (sorted.length - 1)
  const origin =
    block >= frameSize || block <= 0 ? frameStart : frameStart + (frameSize - block) / 2

  let cursor = origin
  sorted.forEach((element, index) => {
    const next = positionForVisualEdge(element, axis, cursor)
    const current = axis === 'horizontal' ? element.position.x : element.position.y
    if (next !== current) {
      patches.set(element.id, axis === 'horizontal' ? { x: next } : { y: next })
    }
    cursor += sizes[index] + gap
  })

  return patches
}
