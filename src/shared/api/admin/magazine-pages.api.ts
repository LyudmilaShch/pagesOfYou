import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'

export type PageType = 'COVER' | 'PAGE' | 'SPREAD' | 'BACK_COVER'

export interface AdminMagazinePage {
  id: string
  magazineTypeId: string
  name: string
  description: string | null
  pageType: PageType
  sortOrder: number
  previewImage: string | null
  canvasData: CanvasData
  isRequired: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateMagazinePagePayload {
  name: string
  description?: string
  pageType?: PageType
  previewImage?: string
  canvasData?: CanvasData
  isRequired?: boolean
}

export type UpdateMagazinePagePayload = Partial<
  CreateMagazinePagePayload & { sortOrder: number; canvasData: CanvasData }
>

export interface ReorderMagazinePagesPayload {
  items: Array<{ id: string; sortOrder: number }>
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  COVER: 'Обложка',
  PAGE: 'Страница',
  SPREAD: 'Разворот',
  BACK_COVER: 'Задняя обложка',
}

function withResolvedPreview(item: AdminMagazinePage): AdminMagazinePage {
  return {
    ...item,
    previewImage: resolveAssetUrl(item.previewImage),
  }
}

export const adminMagazinePagesApi = {
  async list(magazineTypeId: string): Promise<AdminMagazinePage[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminMagazinePage[]>>(
      `/admin/magazine-types/${magazineTypeId}/pages`,
    )
    return data.data.map(withResolvedPreview)
  },

  async getOne(magazineTypeId: string, pageId: string): Promise<AdminMagazinePage> {
    const { data } = await adminHttp.get<BackendResponse<AdminMagazinePage>>(
      `/admin/magazine-types/${magazineTypeId}/pages/${pageId}`,
    )
    return withResolvedPreview(data.data)
  },

  async create(
    magazineTypeId: string,
    payload: CreateMagazinePagePayload,
  ): Promise<AdminMagazinePage> {
    const { data } = await adminHttp.post<BackendResponse<AdminMagazinePage>>(
      `/admin/magazine-types/${magazineTypeId}/pages`,
      payload,
    )
    return withResolvedPreview(data.data)
  },

  async update(
    magazineTypeId: string,
    pageId: string,
    payload: UpdateMagazinePagePayload,
  ): Promise<AdminMagazinePage> {
    const { data } = await adminHttp.patch<BackendResponse<AdminMagazinePage>>(
      `/admin/magazine-types/${magazineTypeId}/pages/${pageId}`,
      payload,
    )
    return withResolvedPreview(data.data)
  },

  async reorder(
    magazineTypeId: string,
    payload: ReorderMagazinePagesPayload,
  ): Promise<AdminMagazinePage[]> {
    const { data } = await adminHttp.patch<BackendResponse<AdminMagazinePage[]>>(
      `/admin/magazine-types/${magazineTypeId}/pages/reorder`,
      payload,
    )
    return data.data.map(withResolvedPreview)
  },

  async remove(magazineTypeId: string, pageId: string): Promise<void> {
    await adminHttp.delete(`/admin/magazine-types/${magazineTypeId}/pages/${pageId}`)
  },

  async duplicate(
    magazineTypeId: string,
    pageId: string,
    targetMagazineTypeId?: string,
  ): Promise<AdminMagazinePage> {
    const { data } = await adminHttp.post<BackendResponse<AdminMagazinePage>>(
      `/admin/magazine-types/${magazineTypeId}/pages/${pageId}/duplicate`,
      targetMagazineTypeId ? { targetMagazineTypeId } : {},
    )
    return withResolvedPreview(data.data)
  },
}
