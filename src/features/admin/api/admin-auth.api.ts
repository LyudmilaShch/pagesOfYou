import type { BackendResponse } from '@/types/api.types'

import { adminHttp } from './admin-http'

export interface AdminLoginPayload {
  email: string
  password: string
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
}

export interface AdminLoginResponse {
  accessToken: string
  expiresIn: number
  admin: AdminUser
}

export const adminAuthApi = {
  async login(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
    const { data } = await adminHttp.post<BackendResponse<AdminLoginResponse>>(
      '/admin/auth/login',
      payload,
    )
    return data.data
  },

  async logout(): Promise<void> {
    await adminHttp.post('/admin/auth/logout')
  },

  async getMe(): Promise<AdminUser> {
    const { data } = await adminHttp.get<BackendResponse<AdminUser>>('/admin/auth/me')
    return data.data
  },
}
