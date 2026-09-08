import { resolveAssetUrl } from '@/shared/config/assets'
import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'

/** Either a real order's gallery (requires the caller to be signed in and own the order) or a
 * guest gallery (opaque token, no auth) — mirrors the backend's `GalleryScope`. */
export type PhotoGalleryScope = { orderId: string } | { guestId: string }

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

function scopeQuery(scope: PhotoGalleryScope): Record<string, string> {
  return 'orderId' in scope ? { orderId: scope.orderId } : { guestId: scope.guestId }
}

export const photoGalleryApi = {
  async list(scope: PhotoGalleryScope): Promise<GalleryPhoto[]> {
    const { data } = await http.get<BackendResponse<RawUploadedFile[]>>('/files', {
      params: scopeQuery(scope),
    })
    return data.data.map(toDomain)
  },

  async upload(
    scope: PhotoGalleryScope,
    file: File,
    dimensions?: { width: number; height: number },
  ): Promise<GalleryPhoto> {
    const formData = new FormData()
    formData.append('file', file)

    if ('orderId' in scope) {
      formData.append('orderId', scope.orderId)
    } else {
      formData.append('guestId', scope.guestId)
    }

    if (dimensions) {
      formData.append('width', String(dimensions.width))
      formData.append('height', String(dimensions.height))
    }

    const { data } = await http.post<BackendResponse<RawUploadedFile>>('/files/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return toDomain(data.data)
  },

  async remove(fileId: string, scope: PhotoGalleryScope): Promise<void> {
    await http.delete(`/files/${fileId}`, {
      params: 'guestId' in scope ? { guestId: scope.guestId } : undefined,
    })
  },

  async setFavorite(
    fileId: string,
    scope: PhotoGalleryScope,
    isFavorite: boolean,
  ): Promise<GalleryPhoto> {
    const { data } = await http.patch<BackendResponse<RawUploadedFile>>(
      `/files/${fileId}/favorite`,
      { isFavorite },
      { params: 'guestId' in scope ? { guestId: scope.guestId } : undefined },
    )
    return toDomain(data.data)
  },

  /** Re-parents a guest's gallery photos onto a real order — unused until the guest→real-order
   * conversion flow itself exists (a separate, not-yet-built step). */
  async claimGuestPhotos(guestId: string, orderId: string): Promise<{ count: number }> {
    const { data } = await http.post<BackendResponse<{ count: number }>>(
      '/files/claim-guest-photos',
      { guestId, orderId },
    )
    return data.data
  },
}
