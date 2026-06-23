import type { BackendResponse, RefreshTokenResponse, SendCodeResponse, VerifyCodeResponse } from '@/types/api.types'

import { http } from './http'

export const authApi = {
  async sendCode(phone: string): Promise<SendCodeResponse> {
    const { data } = await http.post<BackendResponse<SendCodeResponse>>('/auth/send-code', { phone })
    return data.data
  },

  async verifyCode(phone: string, code: string): Promise<VerifyCodeResponse> {
    const { data } = await http.post<BackendResponse<VerifyCodeResponse>>('/auth/verify-code', {
      phone,
      code,
    })
    return data.data
  },

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const { data } = await http.post<BackendResponse<RefreshTokenResponse>>('/auth/refresh', {
      refreshToken,
    })
    return data.data
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout')
  },
}
