import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { mapTree, walkTree } from '@/modules/editor/utils/element-tree.util'
import type { GalleryPhoto } from '../api/photo-gallery.api'
import type { JournalPage } from '../types/order.types'

export interface AutoFillPlaceholder {
  elementId: string
  aspectRatio: number
}

export interface AutoFillPhoto {
  id: string
  url: string
  aspectRatio: number
}

type OrientationBucket = 'landscape' | 'portrait' | 'square'

function getOrientationBucket(aspectRatio: number): OrientationBucket {
  if (aspectRatio > 1.15) {
    return 'landscape'
  }
  if (aspectRatio < 0.87) {
    return 'portrait'
  }
  return 'square'
}

/** Lower is better. Orientation mismatch dominates the score; within the same orientation,
 * ranked by how close the aspect ratios are (log-ratio so e.g. 2:1 vs 1:1 and 1:1 vs 1:2 score
 * the same distance). */
function matchScore(placeholderAspect: number, photoAspect: number): number {
  const orientationPenalty =
    getOrientationBucket(placeholderAspect) === getOrientationBucket(photoAspect) ? 0 : 10
  const aspectDistance = Math.abs(Math.log(placeholderAspect) - Math.log(photoAspect))
  return orientationPenalty + aspectDistance
}

function findBestMatch(pool: AutoFillPhoto[], placeholder: AutoFillPlaceholder): AutoFillPhoto | null {
  let best: AutoFillPhoto | null = null
  let bestScore = Infinity

  for (const photo of pool) {
    const score = matchScore(placeholder.aspectRatio, photo.aspectRatio)
    if (score < bestScore) {
      bestScore = score
      best = photo
    }
  }

  return best
}

/** Best-effort, never blocks: assigns as many placeholders as it reasonably can and leaves the
 * rest for the caller to report as unfilled. Placeholders are matched in the order given — the
 * caller controls page/tree ordering, this only does the pairing. Each photo is used at most
 * once — if there are more empty placeholders than photos, the leftover placeholders stay empty
 * rather than repeat a photo elsewhere in the journal. */
export function matchPhotosToPlaceholders(
  placeholders: AutoFillPlaceholder[],
  photos: AutoFillPhoto[],
): Map<string, string> {
  const assignments = new Map<string, string>()

  if (placeholders.length === 0 || photos.length === 0) {
    return assignments
  }

  const usedPhotoIds = new Set<string>()

  for (const placeholder of placeholders) {
    const pool = photos.filter((photo) => !usedPhotoIds.has(photo.id))
    if (pool.length === 0) {
      break
    }

    const best = findBestMatch(pool, placeholder)
    if (best) {
      assignments.set(placeholder.elementId, best.url)
      usedPhotoIds.add(best.id)
    }
  }

  return assignments
}

export interface AutoFillJournalPagesResult {
  changedPages: Array<{
    journalPageId: string
    canvasData: CanvasData
    /** elementId → assigned photo url, for callers that also need to update a live-mounted
     * editor for this page in place rather than only persisting the merged canvasData. */
    assignments: Map<string, string>
  }>
  filledCount: number
  remainingEmptyCount: number
}

/** Fills empty photo-placeholders across every page — leaves anything already set by the user
 * (manually or by a previous auto-fill run) untouched. Pure function: doesn't touch stores or the
 * network, so the same logic runs identically for a guest's in-memory draft and a real order. */
export function applyAutoFillToJournalPages(
  journalPages: JournalPage[],
  photos: GalleryPhoto[],
): AutoFillJournalPagesResult {
  const availablePhotos: AutoFillPhoto[] = photos
    .filter((photo): photo is GalleryPhoto & { width: number; height: number } =>
      Boolean(photo.width && photo.height),
    )
    .map((photo) => ({ id: photo.id, url: photo.url, aspectRatio: photo.width / photo.height }))

  const changedPages: AutoFillJournalPagesResult['changedPages'] = []
  let filledCount = 0
  let remainingEmptyCount = 0

  // Shrinks as pages are processed — a photo used on one page must not be offered again for a
  // later page. matchPhotosToPlaceholders only de-dupes *within* a single call, so cross-page
  // uniqueness has to be enforced here, across calls.
  let remainingPhotos = availablePhotos

  for (const page of journalPages) {
    const canvas = normalizeCanvasData(page.pageSnapshot)
    const emptyPlaceholders: AutoFillPlaceholder[] = []

    walkTree(canvas.elements, (element) => {
      if (element.type === 'photo-placeholder' && !element.defaultImageUrl) {
        emptyPlaceholders.push({
          elementId: element.id,
          aspectRatio: element.size.width / element.size.height,
        })
      }
    })

    if (emptyPlaceholders.length === 0) {
      continue
    }

    const assignments = matchPhotosToPlaceholders(emptyPlaceholders, remainingPhotos)
    remainingEmptyCount += emptyPlaceholders.length - assignments.size

    if (assignments.size > 0) {
      const usedUrls = new Set(assignments.values())
      remainingPhotos = remainingPhotos.filter((photo) => !usedUrls.has(photo.url))
    }

    if (assignments.size === 0) {
      continue
    }

    const nextElements = mapTree(canvas.elements, (leaf) => {
      if (leaf.type !== 'photo-placeholder') {
        return leaf
      }

      const url = assignments.get(leaf.id)
      if (!url) {
        return leaf
      }

      return { ...leaf, defaultImageUrl: url, cropX: 0, cropY: 0, imageScale: 1 }
    })

    filledCount += assignments.size
    changedPages.push({
      journalPageId: page.id,
      canvasData: { ...canvas, elements: nextElements },
      assignments,
    })
  }

  return { changedPages, filledCount, remainingEmptyCount }
}
