import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
import type { BackendResponse } from '@/types/api.types'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PlaceholderValue } from '@/features/order-builder/types/order.types'

export type AdminOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAID'
  | 'IN_DESIGN'
  | 'DESIGN_REVIEW'
  | 'APPROVED'
  | 'PRINTING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface AdminOrderCustomer {
  id: string
  phone: string | null
  name: string | null
  email?: string | null
}

export interface AdminOrderMagazineType {
  id: string
  name: string
  coverImage: string | null
}

export interface AdminOrderListItem {
  id: string
  status: AdminOrderStatus
  /** Prisma Decimal serialises as string over JSON */
  totalPrice: string | null
  currency: string
  createdAt: string
  submittedAt: string | null
  user: AdminOrderCustomer
  magazineType: AdminOrderMagazineType
}

export interface AdminOrderJournalPageTemplate {
  id: string
  name: string
  pageType: string
  previewImage: string | null
}

export interface AdminOrderJournalPage {
  id: string
  sortOrder: number
  slotType: string
  layoutMode: string | null
  /** Full document — lets the order detail page render a real thumbnail of what the customer
   * actually made (see `JournalSpreadThumbnail.vue`), not just the template's static preview. */
  pageSnapshot: CanvasData
  placeholderValues: PlaceholderValue[]
  magazinePage: AdminOrderJournalPageTemplate
  rightMagazinePage: AdminOrderJournalPageTemplate | null
}

export interface AdminOrderDetail extends AdminOrderListItem {
  magazineStyle: { id: string; name: string } | null
  notes: string | null
  paidAt: string | null
  completedAt: string | null
  updatedAt: string
  journalPages: AdminOrderJournalPage[]
}

export interface PaginatedAdminOrders {
  items: AdminOrderListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminOrdersQuery {
  page?: number
  limit?: number
  search?: string
  status?: AdminOrderStatus
  sortBy?: 'createdAt' | 'submittedAt' | 'totalPrice'
  sortOrder?: 'asc' | 'desc'
}

/** Full document for a single journal page — feeds the advanced per-element editor, same as the
 * customer-facing one (see order-builder's `JournalPageEditorPage.vue`). */
export interface AdminOrderJournalPageDetail {
  id: string
  sortOrder: number
  slotType: string
  layoutMode: string | null
  pageSnapshot: CanvasData
  magazinePage: AdminOrderJournalPageTemplate
  rightMagazinePage: AdminOrderJournalPageTemplate | null
  placeholderValues: PlaceholderValue[]
}

function withResolvedListItem(item: AdminOrderListItem): AdminOrderListItem {
  return {
    ...item,
    magazineType: { ...item.magazineType, coverImage: resolveAssetUrl(item.magazineType.coverImage) },
  }
}

function withResolvedTemplate(
  template: AdminOrderJournalPageTemplate | null,
): AdminOrderJournalPageTemplate | null {
  return template ? { ...template, previewImage: resolveAssetUrl(template.previewImage) } : template
}

function withResolvedPlaceholderValues(values: PlaceholderValue[]): PlaceholderValue[] {
  return values.map((value) =>
    value.valueType === 'PHOTO' && value.jsonValue?.url
      ? { ...value, jsonValue: { ...value.jsonValue, url: resolveAssetUrl(value.jsonValue.url) ?? value.jsonValue.url } }
      : value,
  )
}

function withResolvedJournalPage(page: AdminOrderJournalPageDetail): AdminOrderJournalPageDetail {
  return {
    ...page,
    magazinePage: withResolvedTemplate(page.magazinePage)!,
    rightMagazinePage: withResolvedTemplate(page.rightMagazinePage),
    placeholderValues: withResolvedPlaceholderValues(page.placeholderValues),
  }
}

function withResolvedDetail(item: AdminOrderDetail): AdminOrderDetail {
  return {
    ...item,
    magazineType: { ...item.magazineType, coverImage: resolveAssetUrl(item.magazineType.coverImage) },
    journalPages: item.journalPages.map((page) => ({
      ...page,
      magazinePage: withResolvedTemplate(page.magazinePage)!,
      rightMagazinePage: withResolvedTemplate(page.rightMagazinePage),
      placeholderValues: withResolvedPlaceholderValues(page.placeholderValues),
    })),
  }
}

/** Real Prisma `OrderStatus` values only — unlike `AdminOrderStatus`, no synthetic
 * `PAYMENT_FAILED` (that's derived from Payment records, never an actual Order.status). */
export interface AdminOrderStats {
  total: number
  byStatus: Record<Exclude<AdminOrderStatus, 'PAYMENT_FAILED'>, number>
}

export const adminOrdersApi = {
  async list(query: AdminOrdersQuery = {}): Promise<PaginatedAdminOrders> {
    const { data } = await adminHttp.get<BackendResponse<PaginatedAdminOrders>>('/admin/orders', {
      params: query,
    })
    return {
      ...data.data,
      items: data.data.items.map(withResolvedListItem),
    }
  },

  async getStats(): Promise<AdminOrderStats> {
    const { data } = await adminHttp.get<BackendResponse<AdminOrderStats>>('/admin/orders/stats')
    return data.data
  },

  async getOne(id: string): Promise<AdminOrderDetail> {
    const { data } = await adminHttp.get<BackendResponse<AdminOrderDetail>>(`/admin/orders/${id}`)
    return withResolvedDetail(data.data)
  },

  async getJournalPage(orderId: string, journalPageId: string): Promise<AdminOrderJournalPageDetail> {
    const { data } = await adminHttp.get<BackendResponse<AdminOrderJournalPageDetail>>(
      `/admin/orders/${orderId}/journal-pages/${journalPageId}`,
    )
    return withResolvedJournalPage(data.data)
  },

  async saveJournalPageCanvas(
    orderId: string,
    journalPageId: string,
    canvasData: CanvasData,
  ): Promise<AdminOrderJournalPageDetail> {
    const { data } = await adminHttp.patch<BackendResponse<AdminOrderJournalPageDetail>>(
      `/admin/orders/${orderId}/journal-pages/${journalPageId}/canvas`,
      { canvasData },
    )
    return withResolvedJournalPage(data.data)
  },
}
