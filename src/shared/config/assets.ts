import { getApiBaseUrl } from './api'

/** Public backend origin without the /api prefix — used for /uploads/* assets. */
export function getBackendBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api$/i, '')
}

/** Rewrite stale localhost upload URLs to the configured backend host. */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null
  }

  const base = getBackendBaseUrl()
  const trimmed = url.trim()

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
    const uploadsPath = trimmed.match(/(\/uploads\/.*)$/i)?.[1]
    if (uploadsPath) {
      return uploadsPath
    }

    const path = trimmed.replace(/^https?:\/\/[^/]+/i, '')
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const uploadsPath = trimmed.match(/(\/uploads\/.*)$/i)?.[1]
    if (uploadsPath) {
      return uploadsPath
    }
    return trimmed
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }

  return trimmed
}
