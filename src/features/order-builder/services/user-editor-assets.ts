import type { EditorAssetsProvider } from '@/modules/editor/services/editor-assets'
import { catalogApi } from '../api/catalog.api'
import { filesApi } from '../api/orders.api'

/** Points the shared editor at user-scoped/public endpoints instead of admin-only ones — used by
 * the customer-facing advanced page editor (see `editor-assets.ts` for the injection seam). */
export const userEditorAssetsProvider: EditorAssetsProvider = {
  uploadImage: (file) => filesApi.uploadImage(file),
  listPhotoFrames: () => catalogApi.getPhotoFrames(),
  listCustomPhotoMasks: () => catalogApi.getCustomPhotoMasks(),
}
