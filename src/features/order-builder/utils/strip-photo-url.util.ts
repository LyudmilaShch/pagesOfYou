import type { JournalPage, PlaceholderValue } from '../types/order.types'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'

interface PhotoNode {
  type?: string
  defaultImageUrl?: string | null
  cropX?: number
  cropY?: number
  imageScale?: number
  children?: PhotoNode[]
}

export interface PhotoStripResult<T extends { id: string; pageSnapshot: CanvasData; placeholderValues: PlaceholderValue[] }> {
  pages: T[]
  changed: boolean
  /** Pages whose snapshot itself contained the photo (not only a placeholder overlay). */
  snapshotChangedPageIds: string[]
  /** Photo placeholders whose url matched and must be cleared on the server. */
  clearedPlaceholderElementIdsByPageId: Array<{ pageId: string; elementIds: string[] }>
}

/** Same file even when one side is a relative `/uploads/...` path and the other is absolute. */
export function samePhotoUrl(left: string, right: string): boolean {
  if (left === right) {
    return true
  }
  const pathOf = (url: string) => url.match(/\/uploads\/[^\s?#]+/i)?.[0] ?? null
  const leftPath = pathOf(left)
  const rightPath = pathOf(right)
  return Boolean(leftPath && rightPath && leftPath === rightPath)
}

function stripElements(elements: PhotoNode[], url: string): { elements: PhotoNode[]; changed: boolean } {
  let changed = false
  const next = elements.map((element) => {
    if (Array.isArray(element.children)) {
      const children = stripElements(element.children, url)
      if (children.changed) {
        changed = true
        return { ...element, children: children.elements }
      }
    }
    if (
      element.type === 'photo-placeholder' &&
      typeof element.defaultImageUrl === 'string' &&
      element.defaultImageUrl.trim() &&
      samePhotoUrl(element.defaultImageUrl, url)
    ) {
      changed = true
      return { ...element, defaultImageUrl: null, cropX: 0, cropY: 0, imageScale: 1 }
    }
    return element
  })
  return { elements: next, changed }
}

/** Drops one uploaded photo from placeholder slots and from any snapshot that already baked it in. */
export function stripPhotoUrlFromJournalPages<T extends JournalPage>(pages: T[], url: string): PhotoStripResult<T> {
  const snapshotChangedPageIds: string[] = []
  const clearedPlaceholderElementIdsByPageId: Array<{ pageId: string; elementIds: string[] }> = []
  let changed = false

  const nextPages = pages.map((page) => {
    const snapshot = stripElements((page.pageSnapshot?.elements ?? []) as PhotoNode[], url)
    const clearedElementIds: string[] = []
    const placeholderValues = page.placeholderValues.filter((value) => {
      const photoUrl = value.valueType === 'PHOTO' ? value.jsonValue?.url : undefined
      if (photoUrl && samePhotoUrl(photoUrl, url)) {
        clearedElementIds.push(value.elementId)
        return false
      }
      return true
    })
    if (!snapshot.changed && clearedElementIds.length === 0) {
      return page
    }
    changed = true
    if (snapshot.changed) {
      snapshotChangedPageIds.push(page.id)
    }
    if (clearedElementIds.length > 0) {
      clearedPlaceholderElementIdsByPageId.push({ pageId: page.id, elementIds: clearedElementIds })
    }
    return {
      ...page,
      pageSnapshot: {
        ...page.pageSnapshot,
        elements: snapshot.elements as CanvasData['elements'],
      },
      placeholderValues,
    }
  })

  return { pages: nextPages, changed, snapshotChangedPageIds, clearedPlaceholderElementIdsByPageId }
}
