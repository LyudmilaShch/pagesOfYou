/**
 * Public Catalog API — used by both the admin template editor and the
 * customer-facing order-builder fill flow (no admin session required).
 *
 * GET /catalog/fonts returns only active, non-deleted fonts sorted by
 * sortOrder ASC (server-side).
 */

import { http } from '@/shared/api/http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'

export interface CustomFont {
  id: string
  name: string
  fontFamily: string
  regularFileUrl: string
  boldFileUrl: string | null
  italicFileUrl: string | null
  boldItalicFileUrl: string | null
  sortOrder: number
}

function withResolvedFileUrls(item: CustomFont): CustomFont {
  return {
    ...item,
    regularFileUrl: resolveAssetUrl(item.regularFileUrl) ?? item.regularFileUrl,
    boldFileUrl: item.boldFileUrl ? resolveAssetUrl(item.boldFileUrl) ?? item.boldFileUrl : null,
    italicFileUrl: item.italicFileUrl
      ? resolveAssetUrl(item.italicFileUrl) ?? item.italicFileUrl
      : null,
    boldItalicFileUrl: item.boldItalicFileUrl
      ? resolveAssetUrl(item.boldItalicFileUrl) ?? item.boldItalicFileUrl
      : null,
  }
}

export const fontsApi = {
  async list(): Promise<CustomFont[]> {
    const { data } = await http.get<BackendResponse<CustomFont[]>>('/catalog/fonts')
    return data.data.map(withResolvedFileUrls)
  },
}
