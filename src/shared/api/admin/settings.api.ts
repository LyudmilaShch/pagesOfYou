import { adminHttp } from '@/features/admin/api/admin-http'
import type { BackendResponse } from '@/types/api.types'
import type { PlatformSettings } from '@/shared/api/settings.api'

export type UpdatePlatformSettingsPayload = Partial<PlatformSettings>

export const adminSettingsApi = {
  async get(): Promise<PlatformSettings> {
    const { data } = await adminHttp.get<BackendResponse<PlatformSettings>>('/admin/settings')
    return data.data
  },

  async update(payload: UpdatePlatformSettingsPayload): Promise<PlatformSettings> {
    const { data } = await adminHttp.patch<BackendResponse<PlatformSettings>>(
      '/admin/settings',
      payload,
    )
    return data.data
  },
}
