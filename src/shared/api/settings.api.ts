import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'

export interface PlatformSettings {
  productionDaysMin: number
  productionDaysMax: number
  /** AI regenerations per day (UTC) for a signed-in customer — "осталось N". 0 switches them off. */
  aiDailyLimitUser: number
  /** Hidden daily caps on first AI texts — a signed-in customer / a guest (per IP: ×3). */
  aiDailyFillCapUser: number
  aiDailyFillCapGuest: number
  /** How many times a guest's text updates itself after an answer change. */
  aiGuestAutoUpdatesPerText: number
}

/** Public read of platform-wide settings — e.g. the checkout page's production-time notice. */
export const settingsApi = {
  async get(): Promise<PlatformSettings> {
    const { data } = await http.get<BackendResponse<PlatformSettings>>('/settings')
    return data.data
  },
}
