/**
 * Dedicated Axios instance for admin requests.
 * Uses a separate localStorage key so admin and user sessions never interfere.
 */
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

import { getApiBaseUrl } from '@/shared/config/api'

export const ADMIN_TOKEN_KEY = 'adminAccessToken'

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem('adminUser')
}

export const adminHttp: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

adminHttp.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAdminToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

adminHttp.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearAdminToken()
      if (window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)
