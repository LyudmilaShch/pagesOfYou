import type { OrderDetail, TrashedJournalPage } from '../types/order.types'

const STORAGE_KEY = 'pagesOfYou.localDraft'
/** Bump whenever `OrderDetail`/`JournalPage` shape changes in a way that could make an older
 * stored snapshot unsafe to render — `readLocalDraft` discards on mismatch rather than risk
 * feeding a stale shape into the editor. */
const SCHEMA_VERSION = 1
const TTL_MS = 14 * 24 * 60 * 60 * 1000

export interface StoredLocalDraft {
  schemaVersion: number
  magazineTypeId: string
  order: OrderDetail
  /** SpreadManagerDialog.vue's recycle bin, for a draft that isn't a real backend order yet —
   * optional so older stored snapshots (saved before trash existed) still load fine, just with an
   * empty bin, instead of being discarded outright. */
  trash?: TrashedJournalPage[]
  /** Guest photo-gallery token for this draft only. Absent on drafts saved before galleries were
   * per-journal — those uploads still belong to the browser guest id (see `guest-gallery.util.ts`). */
  galleryGuestId?: string
  savedAt: string
}

/** A guest's in-progress journal lives only in Pinia memory (see `order-builder.store.ts`'s
 * `isLocalDraft` local-draft functions) — this mirrors it into a single localStorage slot so it
 * survives a reload/reopen for a while. One slot per browser: a guest only ever has one active
 * local draft at a time (a second "Начать новый" simply overwrites it). `galleryGuestId` is that
 * draft's photo gallery; a new journal passes a new token so the previous journal's uploads are
 * not listed again. */
export function saveLocalDraft(
  magazineTypeId: string,
  order: OrderDetail,
  trash: TrashedJournalPage[] = [],
  galleryGuestId?: string | null,
): void {
  const stored: StoredLocalDraft = {
    schemaVersion: SCHEMA_VERSION,
    magazineTypeId,
    order,
    trash,
    ...(galleryGuestId?.trim()
      ? { galleryGuestId: galleryGuestId.trim() }
      : {}),
    savedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage unavailable/full (private mode, quota) — guest draft persistence is best-effort.
  }
}

export function readLocalDraft(): StoredLocalDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as StoredLocalDraft
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    const savedAt = new Date(parsed.savedAt).getTime()
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
