import type { Router } from 'vue-router'

import { ordersApi } from '../api/orders.api'

/** Opens an existing order in the editor, at its first page — shared by `AccountPage.vue`'s
 * "Продолжить редактирование" and `ResumeDraftModal.vue`'s equivalent action, so both resume a
 * draft the same way. Throws a user-facing message on failure. */
export async function resumeOrder(router: Router, orderId: string): Promise<void> {
  const detail = await ordersApi.getOne(orderId)
  const firstPage = detail.journalPages[0]
  if (!firstPage) {
    throw new Error('В этом журнале ещё нет ни одного разворота')
  }

  await router.push({
    name: 'journal-page-editor',
    params: { orderId, journalPageId: firstPage.id },
  })
}
