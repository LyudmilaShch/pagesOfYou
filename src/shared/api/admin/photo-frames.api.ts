import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'

export interface AdminPhotoFrame {
  id: string
  name: string
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  sliceTop: number
  sliceRight: number
  sliceBottom: number
  sliceLeft: number
  photoAreaTop: number
  photoAreaRight: number
  photoAreaBottom: number
  photoAreaLeft: number
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreatePhotoFramePayload {
  name: string
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  sliceTop: number
  sliceRight: number
  sliceBottom: number
  sliceLeft: number
  photoAreaTop: number
  photoAreaRight: number
  photoAreaBottom: number
  photoAreaLeft: number
  isActive?: boolean
}

export type UpdatePhotoFramePayload = Partial<CreatePhotoFramePayload & { sortOrder: number }>

export interface ReorderPhotoFramesPayload {
  items: Array<{ id: string; sortOrder: number }>
}

function withResolvedImage(item: AdminPhotoFrame): AdminPhotoFrame {
  return {
    ...item,
    imageUrl: resolveAssetUrl(item.imageUrl) ?? item.imageUrl,
  }
}

export const adminPhotoFramesApi = {
  async list(): Promise<AdminPhotoFrame[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminPhotoFrame[]>>('/admin/photo-frames')
    return data.data.map(withResolvedImage)
  },

  async getOne(id: string): Promise<AdminPhotoFrame> {
    const { data } = await adminHttp.get<BackendResponse<AdminPhotoFrame>>(`/admin/photo-frames/${id}`)
    return withResolvedImage(data.data)
  },

  async create(payload: CreatePhotoFramePayload): Promise<AdminPhotoFrame> {
    const { data } = await adminHttp.post<BackendResponse<AdminPhotoFrame>>('/admin/photo-frames', payload)
    return withResolvedImage(data.data)
  },

  async update(id: string, payload: UpdatePhotoFramePayload): Promise<AdminPhotoFrame> {
    const { data } = await adminHttp.patch<BackendResponse<AdminPhotoFrame>>(
      `/admin/photo-frames/${id}`,
      payload,
    )
    return withResolvedImage(data.data)
  },

  async reorder(payload: ReorderPhotoFramesPayload): Promise<AdminPhotoFrame[]> {
    const { data } = await adminHttp.patch<BackendResponse<AdminPhotoFrame[]>>(
      '/admin/photo-frames/reorder',
      payload,
    )
    return data.data.map(withResolvedImage)
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/photo-frames/${id}`)
  },
}
