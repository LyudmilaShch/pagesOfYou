const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3000/api'

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()

  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }

  return DEFAULT_DEV_API_BASE_URL
}
