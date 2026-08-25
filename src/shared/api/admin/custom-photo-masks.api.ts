import { adminHttp } from '@/features/admin/api/admin-http'
import type { BackendResponse } from '@/types/api.types'

export interface AdminCustomPhotoMaskPoint {
  x: number
  y: number
}

export interface AdminCustomPhotoMask {
  id: string
  name: string
  points: AdminCustomPhotoMaskPoint[]
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateCustomPhotoMaskPayload {
  name: string
  points: AdminCustomPhotoMaskPoint[]
  isActive?: boolean
}

export type UpdateCustomPhotoMaskPayload = Partial<CreateCustomPhotoMaskPayload & { sortOrder: number }>

export interface ReorderCustomPhotoMasksPayload {
  items: Array<{ id: string; sortOrder: number }>
}

export const adminCustomPhotoMasksApi = {
  async list(): Promise<AdminCustomPhotoMask[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminCustomPhotoMask[]>>('/admin/custom-photo-masks')
    return data.data
  },

  async getOne(id: string): Promise<AdminCustomPhotoMask> {
    const { data } = await adminHttp.get<BackendResponse<AdminCustomPhotoMask>>(`/admin/custom-photo-masks/${id}`)
    return data.data
  },

  async create(payload: CreateCustomPhotoMaskPayload): Promise<AdminCustomPhotoMask> {
    const { data } = await adminHttp.post<BackendResponse<AdminCustomPhotoMask>>(
      '/admin/custom-photo-masks',
      payload,
    )
    return data.data
  },

  async update(id: string, payload: UpdateCustomPhotoMaskPayload): Promise<AdminCustomPhotoMask> {
    const { data } = await adminHttp.patch<BackendResponse<AdminCustomPhotoMask>>(
      `/admin/custom-photo-masks/${id}`,
      payload,
    )
    return data.data
  },

  async reorder(payload: ReorderCustomPhotoMasksPayload): Promise<AdminCustomPhotoMask[]> {
    const { data } = await adminHttp.patch<BackendResponse<AdminCustomPhotoMask[]>>(
      '/admin/custom-photo-masks/reorder',
      payload,
    )
    return data.data
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/custom-photo-masks/${id}`)
  },
}
