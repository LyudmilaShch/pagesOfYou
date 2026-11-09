import type { PhotoGalleryScope } from '../api/photo-gallery.api'

/** A fresh token for one guest journal's photo gallery. Deliberately not the browser-wide
 * guest id (`pagesOfYou.guestId`): that id also keys AI usage limits and must stay stable,
 * while a new journal has to start with an empty gallery. */
export function createGuestGalleryId(): string {
  return crypto.randomUUID()
}

/** Which gallery token a resumed guest draft should keep using. Drafts saved before galleries
 * were per-journal have no token of their own — their uploads still live under the browser
 * guest id, so restoring one of those must keep that id rather than minting a new gallery. */
export function galleryIdForRestoredDraft(
  storedGalleryGuestId: unknown,
  legacyGuestId: string,
): string {
  if (typeof storedGalleryGuestId === 'string' && storedGalleryGuestId.trim()) {
    return storedGalleryGuestId.trim()
  }
  return legacyGuestId
}

/** Real orders are scoped by `orderId` (a new order therefore starts empty). A guest journal
 * is scoped by the gallery token bound to that draft, falling back to the browser guest id
 * only when the draft predates per-journal galleries. */
export function resolvePhotoGalleryScope(input: {
  orderId?: string | null
  isLocalDraft: boolean
  guestGalleryId?: string | null
  legacyGuestId: string
}): PhotoGalleryScope {
  if (input.orderId && !input.isLocalDraft) {
    return { orderId: input.orderId }
  }

  const guestId = input.guestGalleryId?.trim() || input.legacyGuestId
  return { guestId }
}

/** Every photo that was in the guest gallery must show up on the order after claim. */
export function claimedGalleryCovers(beforeIds: string[], afterIds: string[]): boolean {
  const claimed = new Set(afterIds)
  return beforeIds.every((id) => claimed.has(id))
}

export async function retryAsync<T>(fn: () => Promise<T>, attempts = 3, delayMs = 0): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < attempts - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('retry failed')
}
