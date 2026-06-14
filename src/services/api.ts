import type { ApiError, ApiResponse } from '@/types/api.types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText,
      status: response.status,
    }
    throw error
  }

  const data = (await response.json()) as T
  return { data }
}

export const api = {
  get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'GET' })
  },

  post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'DELETE' })
  },
}
