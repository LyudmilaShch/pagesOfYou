import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
} as const

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh token queue — prevents multiple simultaneous refresh calls
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null): void {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  pendingQueue = []
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    const is401 = error.response?.status === 401
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh')
    const alreadyRetried = originalRequest._retry

    if (!is401 || isRefreshEndpoint || alreadyRetried) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return http(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    const storedRefreshToken = getRefreshToken()

    if (!storedRefreshToken) {
      isRefreshing = false
      clearTokens()
      redirectToAuth()
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'}/auth/refresh`,
        { refreshToken: storedRefreshToken },
      )

      const { accessToken, refreshToken } = data.data as {
        accessToken: string
        refreshToken: string
      }

      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
      localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)

      // Sync store without circular imports — store reads from localStorage on next call
      http.defaults.headers.common.Authorization = `Bearer ${accessToken}`

      processQueue(null, accessToken)
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return http(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearTokens()
      redirectToAuth()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

function redirectToAuth(): void {
  if (window.location.pathname !== '/auth') {
    window.location.href = '/auth'
  }
}
