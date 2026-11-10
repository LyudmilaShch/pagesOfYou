import type { JournalSlotType } from '../constants/journal.constants'
import { pluralize } from '../../../shared/utils/pluralize.util.ts'

const PAGE_LABELS: Record<JournalSlotType, string> = {
  COVER: 'Обложка',
  SPREAD: 'Разворот',
  BACK_COVER: 'Задняя обложка',
  TOC: 'Содержание',
}

/** One photo-placeholder, already read off a journal page. `adminImageUrl` is the template
 * sample (`defaultImageUrl`). `userUrl` is a photo the customer saved onto the slot. */
export interface CustomerPhotoFact {
  pageId: string
  pageLabel: string
  elementId: string
  slotLabel: string
  slotType: JournalSlotType
  questionKey?: string | null
  adminImageUrl?: string | null
  userUrl?: string | null
}

export interface MissingCustomerPhotoPage {
  journalPageId: string
  pageLabel: string
  slots: Array<{ elementId: string; label: string }>
}

export interface AutoFillPhotoTarget {
  journalPageId: string
  elementId: string
}

function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Slots bound to an anketa question are filled there, not by the photo step. */
export function isTrackedCustomerPhotoSlot(fact: CustomerPhotoFact): boolean {
  return trimmed(fact.questionKey).length === 0
}

/** Cover is empty until the customer picks a photo — an admin sample does not count.
 * Every other slot is filled by a customer photo or by that admin sample. */
export function isCustomerPhotoSlotFilled(fact: CustomerPhotoFact): boolean {
  if (!isTrackedCustomerPhotoSlot(fact)) {
    return true
  }
  if (trimmed(fact.userUrl)) {
    return true
  }
  if (fact.slotType === 'COVER') {
    return false
  }
  return trimmed(fact.adminImageUrl).length > 0
}

/** Automatic placement never takes the cover, an anketa slot, or a slot that already
 * shows an admin sample. */
export function canAutoPlaceCustomerPhoto(fact: CustomerPhotoFact): boolean {
  if (fact.slotType === 'COVER') {
    return false
  }
  if (!isTrackedCustomerPhotoSlot(fact)) {
    return false
  }
  if (trimmed(fact.userUrl) || trimmed(fact.adminImageUrl)) {
    return false
  }
  return true
}

/** The admin sample on the cover is not shown. A customer photo is. */
export function shouldHideCoverAdminImage(fact: Pick<CustomerPhotoFact, 'slotType' | 'userUrl'>): boolean {
  return fact.slotType === 'COVER' && trimmed(fact.userUrl).length === 0
}

export function isLandscapePhoto(
  width: number | null | undefined,
  height: number | null | undefined,
): boolean {
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 && width > height
}

export function customerPhotoPageLabel(slotType: JournalSlotType, spreadIndex?: number): string {
  if (slotType === 'COVER') {
    return PAGE_LABELS.COVER
  }
  if (slotType === 'BACK_COVER') {
    return PAGE_LABELS.BACK_COVER
  }
  if (slotType === 'TOC') {
    return PAGE_LABELS.TOC
  }
  return `${PAGE_LABELS.SPREAD} ${spreadIndex ?? ''}`.trim()
}

function emptyPlaceWord(count: number): string {
  return pluralize(count, 'пустое место', 'пустых места', 'пустых мест')
}

/** One row in the "what's still empty" list. */
export function missingPhotoLine(pageLabel: string, emptyCount: number): string {
  if (pageLabel === PAGE_LABELS.COVER && emptyCount === 1) {
    return 'Обложка — фото не выбрано'
  }
  return `${pageLabel} — ${emptyCount} ${emptyPlaceWord(emptyCount)}`
}

export function missingPhotoPill(count: number): string {
  return `${count} фото не на месте`
}

/** Pages that still have a customer photo hole, in the order the facts were given. */
export function collectMissingPhotoPages(facts: CustomerPhotoFact[]): MissingCustomerPhotoPage[] {
  const order: string[] = []
  const byPage = new Map<string, MissingCustomerPhotoPage>()

  for (const fact of facts) {
    if (!isTrackedCustomerPhotoSlot(fact) || isCustomerPhotoSlotFilled(fact)) {
      continue
    }
    const existing = byPage.get(fact.pageId)
    const slot = { elementId: fact.elementId, label: fact.slotLabel }
    if (existing) {
      existing.slots.push(slot)
      continue
    }
    order.push(fact.pageId)
    byPage.set(fact.pageId, {
      journalPageId: fact.pageId,
      pageLabel: fact.pageLabel,
      slots: [slot],
    })
  }

  return order.map((pageId) => byPage.get(pageId)!)
}

/** Empty spread/back-cover/toc slots that a newly uploaded or spare gallery photo may take.
 * `onlyPageIds` limits the result to the pages just inserted. */
export function collectAutoFillTargets(
  facts: CustomerPhotoFact[],
  onlyPageIds?: ReadonlySet<string>,
): AutoFillPhotoTarget[] {
  const targets: AutoFillPhotoTarget[] = []
  for (const fact of facts) {
    if (onlyPageIds && !onlyPageIds.has(fact.pageId)) {
      continue
    }
    if (!canAutoPlaceCustomerPhoto(fact)) {
      continue
    }
    targets.push({ journalPageId: fact.pageId, elementId: fact.elementId })
  }
  return targets
}
