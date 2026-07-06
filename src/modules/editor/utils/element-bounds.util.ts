import type { PageElement } from '../models'

export interface ElementBoundsRect {
  x: number
  y: number
  width: number
  height: number
}

const LINE_HIT_HEIGHT = 16

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
  return element.visible && !element.locked && element.type !== 'background'
}
