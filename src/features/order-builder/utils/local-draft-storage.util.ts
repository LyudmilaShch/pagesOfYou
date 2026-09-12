import type { OrderDetail } from '../types/order.types'

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
  savedAt: string
}

/** A guest's in-progress journal lives only in Pinia memory (see `order-builder.store.ts`'s
 * `isLocalDraft` local-draft functions) — this mirrors it into a single localStorage slot so it
 * survives a reload/reopen for a while. One slot per browser: a guest only ever has one active
 * local draft at a time (a second "Начать новый" simply overwrites it). */
export function saveLocalDraft(magazineTypeId: string, order: OrderDetail): void {
  const stored: StoredLocalDraft = {
    schemaVersion: SCHEMA_VERSION,
    magazineTypeId,
    order,
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
