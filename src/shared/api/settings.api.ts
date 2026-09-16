import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'

export interface PlatformSettings {
  productionDaysMin: number
  productionDaysMax: number
}

/** Public read of platform-wide settings — e.g. the checkout page's production-time notice. */
export const settingsApi = {
  async get(): Promise<PlatformSettings> {
    const { data } = await http.get<BackendResponse<PlatformSettings>>('/settings')
    return data.data
  },
}
