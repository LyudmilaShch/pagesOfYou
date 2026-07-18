import type Konva from 'konva'

import type { PageElement } from '../models'
import { getElementSelectionBounds, isSelectableEditorElement } from './element-bounds.util'
import type { PagePointer } from './marquee-selection.util'

export function clientToPageCoords(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  pageGroup: Konva.Group,
): PagePointer {
  const rect = container.getBoundingClientRect()
  const transform = pageGroup.getAbsoluteTransform().copy().invert()

  return transform.point({
    x: clientX - rect.left,
    y: clientY - rect.top,
  })
}

/** `elements` must already be in paint order (bottom → top), e.g. `flatElements` from the store. */
export function findPhotoPlaceholderAtPoint(
  elements: PageElement[],
  point: PagePointer,
): PageElement | null {
  const topmostFirst = [...elements].reverse()

  for (const element of topmostFirst) {
    if (element.type !== 'photo-placeholder' || !isSelectableEditorElement(element)) {
      continue
    }

    const bounds = getElementSelectionBounds(element)

    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      return element
    }
  }

  return null
}

export function extractImageFileFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer?.files?.length) {
    return null
  }

  for (const file of Array.from(dataTransfer.files)) {
    if (file.type.startsWith('image/')) {
      return file
    }
  }

  return null
}
