import { getApiBaseUrl } from './api'

/** Public backend origin without the /api prefix — used for /uploads/* assets. */
export function getBackendBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api$/i, '')
}

function normalizeUploadAssetPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized.replace(/^\/api(?=\/uploads\/)/i, '')
}

/** Origin for static /uploads/* — may differ from the API host (e.g. apex vs api. subdomain). */
export function getUploadsBaseUrl(): string {
  const explicit = import.meta.env.VITE_ASSETS_BASE_URL?.trim()
  if (explicit) {
    return explicit.replace(/\/$/, '').replace(/\/api$/i, '')
  }

  const base = getBackendBaseUrl()
  try {
    const url = new URL(base)
    if (url.hostname.startsWith('api.')) {
      url.hostname = url.hostname.slice(4)
      return url.origin
    }
  } catch {
    // ignore invalid URL
  }

  return base
}

/** Store only the public uploads path so URLs survive environment changes. */
export function toStoredAssetPath(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null
  }

  const match = url.trim().match(/\/uploads\/[^\s?#]+/i)
  return match ? match[0] : url.trim()
}

/** Rewrite stored upload paths to absolute URLs on the configured uploads host. */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null
  }

  const trimmed = url.trim()
  const uploadMatch = trimmed.match(/\/uploads\/[^\s?#]+/i)

  if (uploadMatch) {
    const path = normalizeUploadAssetPath(uploadMatch[0])
    return `${getUploadsBaseUrl()}${path}`
  }

  return trimmed
}
