import { adminHttp } from '@/features/admin/api/admin-http'

export interface UploadImageResponse {
  url: string
}

/**
 * Uploads a single image file to the backend.
 * The backend stores it in uploads/magazine-types/ and returns its public URL.
 */
export async function uploadAdminImage(file: File): Promise<UploadImageResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await adminHttp.post<{ data: UploadImageResponse }>(
    '/admin/uploads/image',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )

  // TransformInterceptor wraps response as { success: true, data: { url } }
  return (res.data as unknown as { success: boolean; data: UploadImageResponse }).data
}
