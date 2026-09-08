const GUEST_ID_STORAGE_KEY = 'pagesOfYou.guestId'

/** Opaque per-browser identity for the photo gallery before a real order exists — lets a guest's
 * uploads persist across reloads without requiring an account. Not derived from IP (shared across
 * many people behind NAT, changes mid-session) — a random token is the only reliable option. */
export function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY)
    if (existing) {
      return existing
    }

    const created = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_STORAGE_KEY, created)
    return created
  } catch {
    // Private browsing / storage blocked — fall back to an in-memory id for this page load only.
    return crypto.randomUUID()
  }
}
