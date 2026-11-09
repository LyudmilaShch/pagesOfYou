const STORAGE_KEY = 'pagesOfYou.draftLock'
const CHANNEL_NAME = 'pagesOfYou.draftLock'
/** A tab that stops heartbeating (closed, crashed) stops counting as "open" after this. */
export const DRAFT_LOCK_STALE_MS = 12_000

export interface DraftLock {
  draftId: string
  tabId: string
  at: number
}

export function createTabId(): string {
  return crypto.randomUUID()
}

export function isForeignDraftLock(
  lock: DraftLock | null | undefined,
  tabId: string,
  draftId: string | null,
  now = Date.now(),
  staleMs = DRAFT_LOCK_STALE_MS,
): boolean {
  if (!lock || !draftId) {
    return false
  }
  if (lock.draftId !== draftId || lock.tabId === tabId) {
    return false
  }
  return now - lock.at < staleMs
}

export function readDraftLock(): DraftLock | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as DraftLock
    if (!parsed?.draftId || !parsed.tabId || typeof parsed.at !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeDraftLock(lock: DraftLock): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lock))
  } catch {
    // Private mode: the banner can't cross tabs, editing in this tab still works.
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(lock)
    channel.close()
  } catch {
    // BroadcastChannel missing — the storage event still reaches other tabs.
  }
}

export function subscribeDraftLocks(onLock: (lock: DraftLock | null) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return
    }
    onLock(readDraftLock())
  }
  window.addEventListener('storage', onStorage)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<DraftLock>) => {
      onLock(event.data ?? null)
    }
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
}
