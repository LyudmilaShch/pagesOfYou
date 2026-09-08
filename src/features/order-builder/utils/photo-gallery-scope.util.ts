import { getOrCreateGuestId } from '@/shared/utils/guest-id.util'
import type { PhotoGalleryScope } from '../api/photo-gallery.api'
import type { useOrderBuilderStore } from '../stores/order-builder.store'

/** A real order's gallery once one exists on the backend, the guest gallery otherwise — same
 * rule everywhere the gallery is read from (panel, picker dialog). */
export function getGalleryScope(store: ReturnType<typeof useOrderBuilderStore>): PhotoGalleryScope {
  return store.order && !store.isLocalDraft
    ? { orderId: store.order.id }
    : { guestId: getOrCreateGuestId() }
}
