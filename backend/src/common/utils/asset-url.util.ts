/**
 * Resolve stored asset URLs for the current environment.
 * Handles relative paths and stale localhost URLs from local admin uploads.
 */
export function resolveAssetUrl(
  storedUrl: string | null | undefined,
  backendUrl: string,
): string | null {
  if (!storedUrl?.trim()) {
    return null;
  }

  const base = backendUrl.replace(/\/$/, '');
  const trimmed = storedUrl.trim();

  const isLocalhost =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed);

  if (isLocalhost) {
    const path = trimmed.replace(/^https?:\/\/[^/]+/i, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${path}`;
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
