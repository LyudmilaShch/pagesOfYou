import type { OrderDetail, TrashedJournalPage } from '../types/order.types'

const STORAGE_KEY = 'pagesOfYou.localDrafts'
/** Single-draft key from before a guest could keep several journals. Read once and moved over. */
const LEGACY_STORAGE_KEY = 'pagesOfYou.localDraft'
/** Bump whenever `OrderDetail`/`JournalPage` shape changes in a way that could make an older
 * stored snapshot unsafe to render — `readLocalDrafts` discards that entry rather than risk
 * feeding a stale shape into the editor. */
const SCHEMA_VERSION = 1
export const LOCAL_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

export class LocalDraftStorageError extends Error {
  constructor() {
    super('LOCAL_DRAFT_STORAGE_UNAVAILABLE')
    this.name = 'LocalDraftStorageError'
  }
}

export interface StoredLocalDraft {
  /** Same as `order.id` (`local-<uuid>`). Stable across reloads so a guest can reopen this journal. */
  id: string
  schemaVersion: number
  magazineTypeId: string
  order: OrderDetail
  /** SpreadManagerDialog.vue's recycle bin, for a draft that isn't a real backend order yet. */
  trash?: TrashedJournalPage[]
  /** Guest photo-gallery token for this draft only. */
  galleryGuestId?: string
  /** Server order id once conversion has created the row but the gallery claim has not finished.
   * A retry must reuse it instead of creating a second order. */
  adoptedOrderId?: string
  savedAt: string
}

function isFresh(savedAt: string, now: number): boolean {
  const savedAtMs = new Date(savedAt).getTime()
  return Number.isFinite(savedAtMs) && now - savedAtMs <= LOCAL_DRAFT_TTL_MS
}

function normalizeDraft(raw: Partial<StoredLocalDraft> | null | undefined): StoredLocalDraft | null {
  if (!raw || typeof raw !== 'object' || !raw.order || typeof raw.order !== 'object') {
    return null
  }
  if (!raw.magazineTypeId || !raw.savedAt) {
    return null
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : raw.order.id
  if (!id) {
    return null
  }
  return {
    id,
    schemaVersion: raw.schemaVersion ?? SCHEMA_VERSION,
    magazineTypeId: raw.magazineTypeId,
    order: raw.order,
    trash: raw.trash,
    galleryGuestId: raw.galleryGuestId,
    adoptedOrderId: raw.adoptedOrderId,
    savedAt: raw.savedAt,
  }
}

function readRaw(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as unknown
  } catch (err) {
    if (err instanceof SyntaxError) {
      return null
    }
    throw new LocalDraftStorageError()
  }
}

function parseList(raw: unknown): StoredLocalDraft[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []
  return items
    .map((item) => normalizeDraft(item as Partial<StoredLocalDraft>))
    .filter((item): item is StoredLocalDraft => item !== null)
}

function writeAll(drafts: StoredLocalDraft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    throw new LocalDraftStorageError()
  }
}

/** Every guest journal still inside the 14-day window, newest first. Expired entries are dropped. */
export function readLocalDrafts(now = Date.now()): StoredLocalDraft[] {
  const storedRaw = readRaw(STORAGE_KEY)
  let current = parseList(storedRaw)
  let migrated = false

  if (current.length === 0) {
    const legacy = normalizeDraft(readRaw(LEGACY_STORAGE_KEY) as Partial<StoredLocalDraft> | null)
    if (legacy) {
      current = [legacy]
      migrated = true
    }
  }

  const fresh = current.filter(
    (draft) => draft.schemaVersion === SCHEMA_VERSION && isFresh(draft.savedAt, now),
  )
  fresh.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  if (migrated || fresh.length !== current.length) {
    writeAll(fresh)
    if (migrated) {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        throw new LocalDraftStorageError()
      }
    }
  }

  return fresh
}

export function readLocalDraft(id?: string, now = Date.now()): StoredLocalDraft | null {
  const drafts = readLocalDrafts(now)
  if (!id) {
    return drafts[0] ?? null
  }
  return drafts.find((draft) => draft.id === id || draft.order.id === id) ?? null
}

/** Insert or replace one journal. Other journals in the list stay. Throws if storage can't be written. */
export function saveLocalDraft(
  magazineTypeId: string,
  order: OrderDetail,
  trash: TrashedJournalPage[] = [],
  galleryGuestId?: string | null,
): void {
  const now = Date.now()
  const existing = readLocalDrafts(now)
  const id = order.id
  const previous = existing.find((draft) => draft.id === id || draft.order.id === id)
  const stored: StoredLocalDraft = {
    id,
    schemaVersion: SCHEMA_VERSION,
    magazineTypeId,
    order,
    trash,
    ...(galleryGuestId?.trim()
      ? { galleryGuestId: galleryGuestId.trim() }
      : previous?.galleryGuestId
        ? { galleryGuestId: previous.galleryGuestId }
        : {}),
    ...(previous?.adoptedOrderId ? { adoptedOrderId: previous.adoptedOrderId } : {}),
    savedAt: new Date(now).toISOString(),
  }
  const without = existing.filter((draft) => draft.id !== id && draft.order.id !== id)
  writeAll([stored, ...without])
}

export function markLocalDraftAdopted(id: string, adoptedOrderId: string): void {
  const drafts = readLocalDrafts()
  const index = drafts.findIndex((draft) => draft.id === id || draft.order.id === id)
  if (index === -1) {
    return
  }
  drafts[index] = { ...drafts[index], adoptedOrderId }
  writeAll(drafts)
}

export function removeLocalDraft(id: string): void {
  const drafts = readLocalDrafts().filter((draft) => draft.id !== id && draft.order.id !== id)
  writeAll(drafts)
}

export function clearLocalDrafts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    throw new LocalDraftStorageError()
  }
}

/** @deprecated Use `clearLocalDrafts`. Kept so older call sites that meant "drop the one draft" still compile during the move. */
export function clearLocalDraft(): void {
  clearLocalDrafts()
}
