import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isPhotoElement } from '@/modules/editor/models'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { flattenTree, mapTree } from '@/modules/editor/utils/element-tree.util'
import type { LeafElement } from '@/modules/editor/models'
import {
  materializeCanvasData,
  type LocalPlaceholderDraft,
} from './merge-placeholder-element.util'
import {
  collectAutoFillTargets,
  collectMissingPhotoPages,
  customerPhotoPageLabel,
  shouldHideCoverAdminImage,
  type AutoFillPhotoTarget,
  countPhotosCustomerSupplies,
  type CustomerPhotoFact,
  type MissingCustomerPhotoPage,
} from './photo-slot-rules.util'
import type { JournalPage } from '../types/order.types'

export type { MissingCustomerPhotoPage, AutoFillPhotoTarget }
export { missingPhotoLine, missingPhotoPill, isLandscapePhoto } from './photo-slot-rules.util'

export interface PhotoSlotPreview {
  elementId: string
  url: string | null
  label: string
}

export interface PhotoSlotPreviewPage {
  journalPageId: string
  pageLabel: string
  slots: PhotoSlotPreview[]
}

function userPhotoUrl(
  page: Pick<JournalPage, 'placeholderValues'>,
  elementId: string,
  localByElementId?: Map<string, LocalPlaceholderDraft>,
): string | null {
  const localUrl = localByElementId?.get(elementId)?.jsonValue?.url
  if (typeof localUrl === 'string' && localUrl.trim()) {
    return localUrl.trim()
  }
  const saved = page.placeholderValues.find((value) => value.elementId === elementId)?.jsonValue?.url
  return typeof saved === 'string' && saved.trim() ? saved.trim() : null
}

function photoFacts(journalPages: JournalPage[]): CustomerPhotoFact[] {
  const facts: CustomerPhotoFact[] = []
  let spreadIndex = 0

  for (const page of journalPages) {
    if (page.slotType === 'SPREAD') {
      spreadIndex += 1
    }
    const pageLabel = customerPhotoPageLabel(page.slotType, spreadIndex)
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    let photoIndex = 0

    for (const leaf of leaves) {
      if (!isPhotoElement(leaf)) {
        continue
      }
      photoIndex += 1
      facts.push({
        pageId: page.id,
        pageLabel,
        elementId: leaf.id,
        slotLabel: leaf.label?.trim() || `Место ${photoIndex}`,
        slotType: page.slotType,
        questionKey: leaf.questionKey,
        adminImageUrl: leaf.defaultImageUrl,
        userUrl: userPhotoUrl(page, leaf.id),
      })
    }
  }

  return facts
}

export function countPhotosToUpload(journalPages: JournalPage[]): number {
  return countPhotosCustomerSupplies(photoFacts(journalPages))
}

/** Customer photo holes, in journal order. Anketa slots are omitted. An admin sample fills
 * every slot except the cover — the cover stays empty until the customer picks a photo. */
export function collectPhotoSlotPreview(journalPages: JournalPage[]): PhotoSlotPreviewPage[] {
  return collectMissingPhotoPages(photoFacts(journalPages)).map((page) => ({
    journalPageId: page.journalPageId,
    pageLabel: page.pageLabel,
    slots: page.slots.map((slot) => ({ ...slot, url: null })),
  }))
}

export function countEmptyPhotoSlots(pages: Array<{ slots: unknown[] }>): number {
  return pages.reduce((sum, page) => sum + page.slots.length, 0)
}

export function hasMissingCustomerPhotos(journalPages: JournalPage[]): boolean {
  return collectPhotoSlotPreview(journalPages).length > 0
}

/** Slots a spare gallery photo may fill. Pass the ids of a spread that was just added to
 * avoid pouring those photos into older holes the customer left empty on purpose. */
export function collectEmptyAutoFillSlots(
  journalPages: JournalPage[],
  onlyPageIds?: ReadonlySet<string>,
): AutoFillPhotoTarget[] {
  return collectAutoFillTargets(photoFacts(journalPages), onlyPageIds)
}

export function findNextEmptyAutoFillSlot(
  journalPages: JournalPage[],
): AutoFillPhotoTarget | null {
  return collectEmptyAutoFillSlots(journalPages)[0] ?? null
}

/** Customer-facing canvas. The cover's admin sample is removed so the slot renders empty
 * until a customer photo is saved. Other pages keep the admin sample. */
export function presentCustomerPageCanvas(
  page: Pick<JournalPage, 'slotType' | 'pageSnapshot' | 'placeholderValues'>,
  localByElementId?: Map<string, LocalPlaceholderDraft>,
): CanvasData {
  const canvas = materializeCanvasData(
    normalizeCanvasData(page.pageSnapshot),
    page.placeholderValues,
    localByElementId,
  )
  if (page.slotType !== 'COVER') {
    return canvas
  }

  return {
    ...canvas,
    elements: mapTree(canvas.elements, (leaf) => {
      const hideSample = shouldHideCoverAdminImage({
        slotType: 'COVER',
        userUrl: userPhotoUrl(page, leaf.id, localByElementId),
      })
      if (!hideSample) {
        return leaf
      }
      if (leaf.type !== 'photo-placeholder' || !leaf.defaultImageUrl) {
        return leaf
      }
      return { ...leaf, defaultImageUrl: null } as LeafElement
    }),
  }
}

export type { MissingCustomerPhotoPage as MissingPhotoPage }
