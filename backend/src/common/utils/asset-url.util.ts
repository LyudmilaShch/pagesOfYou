function normalizeUploadAssetPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.replace(/^\/api(?=\/uploads\/)/i, '');
}

function stripApiSubdomain(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname.startsWith('api.')) {
      url.hostname = url.hostname.slice(4);
      return url.origin;
    }
  } catch {
    // ignore invalid URL
  }

  return origin;
}

/** Origin for static /uploads/* — may differ from the API host (e.g. apex vs api. subdomain). */
export function getUploadsBaseUrl(backendUrl: string): string {
  const explicit =
    process.env.ASSETS_URL?.trim() || process.env.UPLOADS_BASE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, '').replace(/\/api$/i, '');
  }

  const base = backendUrl.replace(/\/$/, '').replace(/\/api$/i, '');
  return stripApiSubdomain(base);
}

/**
 * Resolve stored asset URLs for the current environment.
 * Handles relative paths, stale localhost URLs, and legacy absolute api.* URLs.
 */
export function resolveAssetUrl(
  storedUrl: string | null | undefined,
  backendUrl: string,
): string | null {
  if (!storedUrl?.trim()) {
    return null;
  }

  const trimmed = storedUrl.trim();
  const uploadMatch = trimmed.match(/\/uploads\/[^\s?#]+/i);

  if (uploadMatch) {
    const path = normalizeUploadAssetPath(uploadMatch[0]);
    return `${getUploadsBaseUrl(backendUrl)}${path}`;
  }

  return trimmed;
}

/** Store only the public uploads path so URLs survive environment changes. */
export function toStoredAssetPath(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) {
    return null;
  }

  const match = url.trim().match(/\/uploads\/[^\s?#]+/i);
  return match ? match[0] : url.trim();
}
