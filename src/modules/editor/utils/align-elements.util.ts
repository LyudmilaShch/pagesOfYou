import type { PageElement } from '../models'

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
  const { x, y } = element.position
  const { width, height } = element.size

  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
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
