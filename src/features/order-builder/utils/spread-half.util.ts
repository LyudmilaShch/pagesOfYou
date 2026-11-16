import {
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import type { PageElement } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { getSpreadPageSide, isSpreadCanvas } from '@/modules/editor/utils/spread.util'

/** Which half of a spread canvas holds `elementId`. Null when this is not a spread, or the
 * element is not on it. Uses the element's center, same rule as the editor's page side. */
export function spreadHalfForElement(
  canvas: { pageWidth?: number; pageHeight?: number; elements: PageElement[] } | null | undefined,
  elementId: string | null | undefined,
): 'left' | 'right' | null {
  if (!canvas || !elementId) {
    return null
  }

  const pageWidth = canvas.pageWidth ?? A4_SPREAD_PAGE_WIDTH
  const pageHeight = canvas.pageHeight ?? A4_SPREAD_PAGE_HEIGHT
  if (!isSpreadCanvas(pageWidth, pageHeight)) {
    return null
  }

  const leaf = flattenTree(canvas.elements).find((item) => item.id === elementId)
  if (!leaf) {
    return null
  }

  return getSpreadPageSide(leaf.position.x, pageWidth, pageHeight, leaf.size.width)
}

/** Which empty slot to reveal. A hole on the left page wins, including when the right page is
 * empty too — the right page is used only when the left page has nothing missing. */
export function preferredEmptySlotElementId(
  canvas: { pageWidth?: number; pageHeight?: number; elements: PageElement[] } | null | undefined,
  elementIds: string[],
): string | null {
  const onLeft = elementIds.find((id) => spreadHalfForElement(canvas, id) === 'left')
  return onLeft ?? elementIds[0] ?? null
}
