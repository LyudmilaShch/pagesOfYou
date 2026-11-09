const STORAGE_KEY = 'pagesOfYou.draftPresence'
const CHANNEL_NAME = 'pagesOfYou.draftPresence'

/** How often a tab refreshes its presence. */
export const PRESENCE_HEARTBEAT_MS = 4_000
/**
 * A peer counts as open until this long after its last heartbeat. Three missed beats still
 * keep the banner up, so a late timer cannot hide it between heartbeats.
 */
export const PRESENCE_TTL_MS = PRESENCE_HEARTBEAT_MS * 4

export interface TabPresence {
  tabId: string
  /** Null when this tab is not editing a guest draft. `left` removes it immediately. */
  draftId: string | null
  at: number
  /** The tab closed or navigated away. Other tabs drop it instead of waiting for the TTL. */
  left?: boolean
}

export function createTabId(): string {
  return crypto.randomUUID()
}

export function isPresenceFresh(presence: TabPresence, now: number, ttlMs = PRESENCE_TTL_MS): boolean {
  return typeof presence.at === 'number' && now - presence.at < ttlMs
}

/** True while some other tab's fresh presence is for this same draft. Our own heartbeats do not count. */
export function hasOtherTabOnDraft(
  presences: readonly TabPresence[],
  tabId: string,
  draftId: string | null,
  now = Date.now(),
  ttlMs = PRESENCE_TTL_MS,
): boolean {
  if (!draftId) {
    return false
  }
  return presences.some(
    (presence) =>
      presence.tabId !== tabId &&
      presence.draftId === draftId &&
      !presence.left &&
      isPresenceFresh(presence, now, ttlMs),
  )
}

/** Merge by tabId. A newer beat replaces that tab only. A `left` beat removes it. Stale rows drop out. */
export function mergePresences(
  current: readonly TabPresence[],
  incoming: readonly TabPresence[],
  now = Date.now(),
  ttlMs = PRESENCE_TTL_MS,
): TabPresence[] {
  const byId = new Map<string, TabPresence>()

  for (const presence of current) {
    if (!presence?.tabId || presence.left || !isPresenceFresh(presence, now, ttlMs)) {
      continue
    }
    byId.set(presence.tabId, presence)
  }

  for (const presence of incoming) {
    if (!presence?.tabId || typeof presence.at !== 'number') {
      continue
    }
    if (presence.left) {
      byId.delete(presence.tabId)
      continue
    }
    if (!isPresenceFresh(presence, now, ttlMs)) {
      continue
    }
    const previous = byId.get(presence.tabId)
    if (!previous || presence.at >= previous.at) {
      byId.set(presence.tabId, {
        tabId: presence.tabId,
        draftId: presence.draftId ?? null,
        at: presence.at,
      })
    }
  }

  return [...byId.values()]
}

export function readDraftPresences(): TabPresence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is TabPresence =>
        Boolean(item) &&
        typeof item.tabId === 'string' &&
        (typeof item.draftId === 'string' || item.draftId === null) &&
        typeof item.at === 'number',
    )
  } catch {
    return []
  }
}

export function writeDraftPresence(presences: readonly TabPresence[], beat: TabPresence): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presences))
  } catch {
    // Private mode: other tabs still hear the BroadcastChannel beat when it is available.
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(beat)
    channel.close()
  } catch {
    // BroadcastChannel missing — the storage event still reaches other tabs.
  }
}

export function subscribeDraftPresences(onPresence: (incoming: TabPresence[]) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return
    }
    onPresence(readDraftPresences())
  }
  window.addEventListener('storage', onStorage)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<TabPresence>) => {
      if (event.data?.tabId) {
        onPresence([event.data])
      }
    }
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
}
