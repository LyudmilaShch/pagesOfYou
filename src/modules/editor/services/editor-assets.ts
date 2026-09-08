import { ref } from 'vue'

import { adminPhotoFramesApi, type AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'
import { adminCustomPhotoMasksApi, type AdminCustomPhotoMask } from '@/shared/api/admin/custom-photo-masks.api'
import { uploadAdminImage } from '@/shared/api/admin/uploads.api'

/** Where the editor gets its reference-data (frame/mask libraries) and image uploads from —
 * lets the same editor UI run against admin-only endpoints (default) or user-scoped ones,
 * without the components themselves knowing which. */
export interface EditorAssetsProvider {
  uploadImage(file: File): Promise<{ url: string }>
  listPhotoFrames(): Promise<AdminPhotoFrame[]>
  listCustomPhotoMasks(): Promise<AdminCustomPhotoMask[]>
}

export const adminEditorAssetsProvider: EditorAssetsProvider = {
  uploadImage: uploadAdminImage,
  listPhotoFrames: () => adminPhotoFramesApi.list(),
  listCustomPhotoMasks: () => adminCustomPhotoMasksApi.list(),
}

export const editorAssets = ref<EditorAssetsProvider>(adminEditorAssetsProvider)

/** Call once, before the editor loads, to point it at a non-admin data source (e.g. the
 * customer-facing advanced page editor). Defaults back to `adminEditorAssetsProvider` otherwise. */
export function provideEditorAssets(provider: EditorAssetsProvider): void {
  editorAssets.value = provider
}
