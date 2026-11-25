import { http } from '@/shared/api/http'
import { PHOTO_UPLOAD_TIMEOUT_MS } from '@/shared/utils/photo-upload-error.util'
import type { BackendResponse } from '@/types/api.types'
import type { PhotoGalleryScope } from './photo-gallery.api'

export interface PhoneUploadSessionTokens {
  uploadToken: string
  revokeToken: string
  expiresAt: string
}

export interface PhoneUploadSessionStatus {
  valid: boolean
  expiresAt: string | null
}

export const phoneUploadApi = {
  async create(scope: PhotoGalleryScope): Promise<PhoneUploadSessionTokens> {
    const { data } = await http.post<BackendResponse<PhoneUploadSessionTokens>>(
      '/files/phone-sessions',
      scope,
    )
    return data.data
  },

  async status(uploadToken: string): Promise<PhoneUploadSessionStatus> {
    const { data } = await http.get<BackendResponse<PhoneUploadSessionStatus>>(
      `/files/phone-sessions/${encodeURIComponent(uploadToken)}`,
    )
    return data.data
  },

  async upload(
    uploadToken: string,
    file: File,
    dimensions?: { width: number; height: number },
  ): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    if (dimensions) {
      formData.append('width', String(dimensions.width))
      formData.append('height', String(dimensions.height))
    }

    await http.post(`/files/phone-sessions/${encodeURIComponent(uploadToken)}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: PHOTO_UPLOAD_TIMEOUT_MS,
    })
  },

  async revoke(revokeToken: string): Promise<void> {
    await http.post('/files/phone-sessions/revoke', { revokeToken })
  },
}
