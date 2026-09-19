import type { RouteLocationRaw, Router } from 'vue-router'

import { ordersApi } from '../api/orders.api'
import type { OrderDetail } from '../types/order.types'

/** Where to resume an existing draft — most advanced signal first: delivery details filled in →
 * they'd reached checkout; any questionnaire answer saved → the anketa; otherwise the photo step,
 * since that's what immediately follows building the journal itself (step 1, already done by the
 * time an order exists to resume). There's no separate "current step" field on the order, so this
 * infers it from what's already on it — shared by `resumeOrder` below (a real backend draft) and
 * `CreateOrderPage.vue`'s guest branch (a local draft has the same shape but isn't fetched via
 * `ordersApi`, so it can't go through `resumeOrder` itself). `null` if the order has no pages yet
 * (shouldn't normally happen — even a fresh draft is seeded with its initial spreads). */
export function resolveResumeRoute(order: OrderDetail): RouteLocationRaw | null {
  if (order.journalPages.length === 0) {
    return null
  }

  if (order.deliveryMethod || order.deliveryAddress || order.recipientName) {
    return { name: 'order-checkout', params: { orderId: order.id } }
  }

  if (order.questionAnswers.length > 0) {
    return { name: 'order-questionnaire', params: { orderId: order.id } }
  }

  return { name: 'order-photo-upload', params: { orderId: order.id } }
}

/** Opens an existing draft at whichever step the user actually left off on — shared by
 * `AccountPage.vue`'s "Продолжить редактирование" and `ResumeDraftModal.vue`'s equivalent action,
 * so both resume a draft the same way. Throws a user-facing message on failure. */
export async function resumeOrder(router: Router, orderId: string): Promise<void> {
  const detail = await ordersApi.getOne(orderId)
  const target = resolveResumeRoute(detail)
  if (!target) {
    throw new Error('В этом журнале ещё нет ни одного разворота')
  }

  await router.push(target)
}
