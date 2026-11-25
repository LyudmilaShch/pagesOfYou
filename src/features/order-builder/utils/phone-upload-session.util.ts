import type { PhotoGalleryScope } from '../api/photo-gallery.api'

export interface StoredPhoneUploadSession {
  uploadToken: string
  revokeToken: string
  expiresAt: string
}

export function phoneUploadStorageKey(scope: PhotoGalleryScope): string {
  if ('orderId' in scope) {
    return `pagesOfYou.phoneUpload.order.${scope.orderId}`
  }
  return `pagesOfYou.phoneUpload.guest.${scope.guestId}`
}

/** Absolute URL encoded in the QR. `basePath` is Vite's `BASE_URL` (`/` in production). */
export function phoneUploadAbsoluteUrl(origin: string, basePath: string, uploadToken: string): string {
  const normalizedOrigin = origin.replace(/\/$/, '')
  const trimmedBase = basePath === '/' ? '' : basePath.replace(/\/$/, '')
  return `${normalizedOrigin}${trimmedBase}/phone-upload/${encodeURIComponent(uploadToken)}`
}

export function parseStoredPhoneUploadSession(
  raw: string | null,
  now = Date.now(),
): StoredPhoneUploadSession | null {
  if (!raw) {
    return null
  }

  let parsed: Partial<StoredPhoneUploadSession>
  try {
    parsed = JSON.parse(raw) as Partial<StoredPhoneUploadSession>
  } catch {
    return null
  }

  if (!parsed.uploadToken || !parsed.revokeToken || !parsed.expiresAt) {
    return null
  }

  const expiresAt = Date.parse(parsed.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return null
  }

  return {
    uploadToken: parsed.uploadToken,
    revokeToken: parsed.revokeToken,
    expiresAt: parsed.expiresAt,
  }
}

/** Drops a stored session that is missing, broken, or already expired. */
export function readStoredPhoneUploadSession(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  now = Date.now(),
): StoredPhoneUploadSession | null {
  const raw = storage.getItem(key)
  const parsed = parseStoredPhoneUploadSession(raw, now)
  if (raw && !parsed) {
    storage.removeItem(key)
  }
  return parsed
}

/** Photos from a newest-first gallery list that this page has not seen yet. */
export function unseenPhotos<T extends { id: string }>(
  incomingNewestFirst: readonly T[],
  knownIds: ReadonlySet<string>,
): T[] {
  return incomingNewestFirst.filter((item) => !knownIds.has(item.id))
}
