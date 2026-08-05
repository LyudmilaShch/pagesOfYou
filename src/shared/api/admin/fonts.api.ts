import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'

export interface AdminFont {
  id: string
  name: string
  fontFamily: string
  regularFileUrl: string
  boldFileUrl: string | null
  italicFileUrl: string | null
  boldItalicFileUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateFontPayload {
  name: string
  regularFileUrl: string
  boldFileUrl?: string
  italicFileUrl?: string
  boldItalicFileUrl?: string
  isActive?: boolean
}

export type UpdateFontPayload = Partial<CreateFontPayload & { sortOrder: number }>

export interface ReorderFontsPayload {
  items: Array<{ id: string; sortOrder: number }>
}

function withResolvedFileUrls(item: AdminFont): AdminFont {
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

export const adminFontsApi = {
  async list(): Promise<AdminFont[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminFont[]>>('/admin/fonts')
    return data.data.map(withResolvedFileUrls)
  },

  async getOne(id: string): Promise<AdminFont> {
    const { data } = await adminHttp.get<BackendResponse<AdminFont>>(`/admin/fonts/${id}`)
    return withResolvedFileUrls(data.data)
  },

  async create(payload: CreateFontPayload): Promise<AdminFont> {
    const { data } = await adminHttp.post<BackendResponse<AdminFont>>('/admin/fonts', payload)
    return withResolvedFileUrls(data.data)
  },

  async update(id: string, payload: UpdateFontPayload): Promise<AdminFont> {
    const { data } = await adminHttp.patch<BackendResponse<AdminFont>>(
      `/admin/fonts/${id}`,
      payload,
    )
    return withResolvedFileUrls(data.data)
  },

  async reorder(payload: ReorderFontsPayload): Promise<AdminFont[]> {
    const { data } = await adminHttp.patch<BackendResponse<AdminFont[]>>(
      '/admin/fonts/reorder',
      payload,
    )
    return data.data.map(withResolvedFileUrls)
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/fonts/${id}`)
  },
}
