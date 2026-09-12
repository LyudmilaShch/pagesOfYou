/** Mirrors the backend's `OrderStatus` Prisma enum exactly (11 values) — the admin-facing
 * `AdminOrderStatus` (`src/shared/api/admin/orders.api.ts`) additionally lists a `PAYMENT_FAILED`
 * that doesn't actually exist in the schema; don't copy that drift here. */
export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'IN_DESIGN'
  | 'DESIGN_REVIEW'
  | 'APPROVED'
  | 'PRINTING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Черновик',
  SUBMITTED: 'Оформлен',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAID: 'Оплачен',
  IN_DESIGN: 'В дизайне',
  DESIGN_REVIEW: 'На проверке',
  APPROVED: 'Утверждён',
  PRINTING: 'В печати',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  PAYMENT_PENDING: 'warning',
  PAID: 'success',
  IN_DESIGN: 'info',
  DESIGN_REVIEW: 'warning',
  APPROVED: 'success',
  PRINTING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
}
