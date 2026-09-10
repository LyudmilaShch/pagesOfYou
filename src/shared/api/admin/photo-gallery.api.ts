import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'

/** Admin counterpart of `order-builder`'s `photoGalleryApi` — always scoped to a specific order
 * (no guest galleries, no ownership check: an admin isn't the order's owner). */
export interface GalleryPhoto {
  id: string
  url: string
  width: number | null
  height: number | null
  isFavorite: boolean
  originalName: string | null
  createdAt: string
}

interface RawUploadedFile {
  id: string
  url: string
  width: number | null
  height: number | null
  isFavorite: boolean
  originalName: string | null
  createdAt: string
}

function toDomain(item: RawUploadedFile): GalleryPhoto {
  return {
    ...item,
    url: resolveAssetUrl(item.url) ?? item.url,
  }
}

export const adminPhotoGalleryApi = {
  async list(orderId: string): Promise<GalleryPhoto[]> {
    const { data } = await adminHttp.get<BackendResponse<RawUploadedFile[]>>(
      `/admin/orders/${orderId}/photos`,
    )
    return data.data.map(toDomain)
  },

  async upload(
    orderId: string,
    file: File,
    dimensions?: { width: number; height: number },
  ): Promise<GalleryPhoto> {
    const formData = new FormData()
    formData.append('file', file)

    if (dimensions) {
      formData.append('width', String(dimensions.width))
      formData.append('height', String(dimensions.height))
    }

    const { data } = await adminHttp.post<BackendResponse<RawUploadedFile>>(
      `/admin/orders/${orderId}/photos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )

    return toDomain(data.data)
  },

  async remove(orderId: string, fileId: string): Promise<void> {
    await adminHttp.delete(`/admin/orders/${orderId}/photos/${fileId}`)
  },

  async setFavorite(orderId: string, fileId: string, isFavorite: boolean): Promise<GalleryPhoto> {
    const { data } = await adminHttp.patch<BackendResponse<RawUploadedFile>>(
      `/admin/orders/${orderId}/photos/${fileId}/favorite`,
      { isFavorite },
    )
    return toDomain(data.data)
  },
}
