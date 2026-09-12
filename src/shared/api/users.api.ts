import type { BackendResponse } from '@/types/api.types'

import { http } from './http'

export interface MeResponse {
  id: string
  phone: string | null
  name: string | null
  email: string | null
  role: string
  userNumber: number
  avatarUrl: string | null
  createdAt: string
}

export interface UpdateMePayload {
  /** Empty string clears the name back to the "Пользователь #{userNumber}" fallback. */
  name?: string
  /** URL of an already-uploaded image (via `filesApi.uploadImage`). Empty string removes it. */
  avatarUrl?: string
}

export const usersApi = {
  async getMe(): Promise<MeResponse> {
    const { data } = await http.get<BackendResponse<MeResponse>>('/users/me')
    return data.data
  },

  async updateMe(payload: UpdateMePayload): Promise<MeResponse> {
    const { data } = await http.patch<BackendResponse<MeResponse>>('/users/me', payload)
    return data.data
  },
}
