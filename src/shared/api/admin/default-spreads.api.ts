import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'
import type { JournalSpreadLayout } from '@/features/order-builder/constants/journal.constants'

export interface AdminDefaultSpread {
  id: string
  sortOrder: number
  layoutMode: JournalSpreadLayout
  magazinePageId: string
  rightMagazinePageId: string | null
  magazinePage: {
    id: string
    name: string
    pageType: string
    previewImage: string | null
  }
  rightMagazinePage: {
    id: string
    name: string
    pageType: string
    previewImage: string | null
  } | null
}

export interface DefaultSpreadItemPayload {
  layoutMode: JournalSpreadLayout
  magazinePageId: string
  rightMagazinePageId?: string
}

export interface SetDefaultSpreadsPayload {
  spreads: DefaultSpreadItemPayload[]
}

function withResolvedPreview(item: AdminDefaultSpread): AdminDefaultSpread {
  return {
    ...item,
    magazinePage: {
      ...item.magazinePage,
      previewImage: resolveAssetUrl(item.magazinePage.previewImage),
    },
    rightMagazinePage: item.rightMagazinePage
      ? {
          ...item.rightMagazinePage,
          previewImage: resolveAssetUrl(item.rightMagazinePage.previewImage),
        }
      : null,
  }
}

export const adminDefaultSpreadsApi = {
  async list(magazineTypeId: string): Promise<AdminDefaultSpread[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminDefaultSpread[]>>(
      `/admin/magazine-types/${magazineTypeId}/default-spreads`,
    )
    return data.data.map(withResolvedPreview)
  },

  async replace(
    magazineTypeId: string,
    payload: SetDefaultSpreadsPayload,
  ): Promise<AdminDefaultSpread[]> {
    const { data } = await adminHttp.put<BackendResponse<AdminDefaultSpread[]>>(
      `/admin/magazine-types/${magazineTypeId}/default-spreads`,
      payload,
    )
    return data.data.map(withResolvedPreview)
  },
}
