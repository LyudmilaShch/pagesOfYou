import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isPhotoElement } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { getJournalPageDisplayName } from './journal-structure.util'
import type { JournalPage } from '../types/order.types'

export interface PhotoSlotPreview {
  elementId: string
  url: string | null
}

export interface PhotoSlotPreviewPage {
  journalPageId: string
  pageLabel: string
  slots: PhotoSlotPreview[]
}

/** Every photo-placeholder slot on pages that still have at least one empty one, in journal order
 * — the "which spreads need more photos, and where exactly" breakdown behind
 * `MissingPhotosModal.vue` (and the gate in `QuestionnairePage.vue`'s `finish()` that opens it).
 * Pages with all their photo slots already filled are omitted entirely — this is a punch list, not
 * a full journal dump. */
export function collectPhotoSlotPreview(journalPages: JournalPage[]): PhotoSlotPreviewPage[] {
  const result: PhotoSlotPreviewPage[] = []
  let spreadIndex = 0

  for (const page of journalPages) {
    if (page.slotType === 'SPREAD') {
      spreadIndex += 1
    }

    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
    const slots: PhotoSlotPreview[] = leaves.filter(isPhotoElement).map((leaf) => ({
      elementId: leaf.id,
      url: valueByElementId.get(leaf.id)?.jsonValue?.url ?? null,
    }))

    if (slots.some((slot) => !slot.url)) {
      result.push({
        journalPageId: page.id,
        pageLabel: getJournalPageDisplayName(page, spreadIndex),
        slots,
      })
    }
  }

  return result
}

export function countEmptyPhotoSlots(pages: PhotoSlotPreviewPage[]): number {
  return pages.reduce((sum, page) => sum + page.slots.filter((slot) => !slot.url).length, 0)
}
