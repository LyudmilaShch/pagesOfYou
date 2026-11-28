import { readLocalDraft, type StoredLocalDraft } from './local-draft-storage.util.ts'

/** Shown when a `local-*` URL has no fresh snapshot left in this browser. */
export const LOST_LOCAL_DRAFT_MESSAGE =
  'Черновик заказа был потерян (например, из-за обновления страницы) — начните заново.'

/** The slice of the order-builder store these order routes need in order to open. */
export interface OrderRouteStore {
  order: { id: string } | null
  loadOrder: (orderId: string) => Promise<void>
  restoreLocalDraft: (stored: StoredLocalDraft) => Promise<void>
}

/**
 * Makes sure the store holds the order this route points at. A guest journal (`local-*`) is read
 * back from localStorage, so a reload of the editor, photos, questionnaire, or review step
 * continues the same draft. A real order is fetched from the server. A missing or expired guest
 * snapshot still fails with {@link LOST_LOCAL_DRAFT_MESSAGE}.
 */
export async function ensureOrderForRoute(orderId: string, store: OrderRouteStore): Promise<void> {
  if (store.order?.id === orderId) {
    return
  }

  if (orderId.startsWith('local-')) {
    const draft = readLocalDraft(orderId)
    if (!draft) {
      throw new Error(LOST_LOCAL_DRAFT_MESSAGE)
    }
    await store.restoreLocalDraft(draft)
    return
  }

  await store.loadOrder(orderId)
}
