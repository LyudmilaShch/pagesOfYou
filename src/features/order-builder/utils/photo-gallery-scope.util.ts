import { getOrCreateGuestId } from '@/shared/utils/guest-id.util'
import type { PhotoGalleryScope } from '../api/photo-gallery.api'
import type { useOrderBuilderStore } from '../stores/order-builder.store'
import { resolvePhotoGalleryScope } from './guest-gallery.util'

/** A real order's gallery once one exists on the backend, the guest gallery otherwise — same
 * rule everywhere the gallery is read from (panel, picker dialog). A guest journal uses the
 * gallery token stored with that draft, not the browser-wide guest id, so starting a new
 * journal does not list the previous journal's photos. The legacy guest id is only a fallback
 * for drafts saved before that token existed, and it is not created for a signed-in order. */
export function getGalleryScope(
  store: ReturnType<typeof useOrderBuilderStore>,
): PhotoGalleryScope {
  const orderId = store.order?.id ?? null
  if (orderId && !store.isLocalDraft) {
    return resolvePhotoGalleryScope({
      orderId,
      isLocalDraft: false,
      guestGalleryId: null,
      legacyGuestId: '',
    })
  }

  return resolvePhotoGalleryScope({
    orderId,
    isLocalDraft: store.isLocalDraft,
    guestGalleryId: store.guestGalleryId,
    legacyGuestId: getOrCreateGuestId(),
  })
}
