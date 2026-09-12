import { resolveAssetUrl } from '@/shared/config/assets'
import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { DeliveryMethod, OrderDetail, PaginatedOrders, PlaceholderInput } from '../types/order.types'
import type { JournalSlotType, JournalSpreadLayout } from '../constants/journal.constants'

export interface SetJournalPageTemplatePayload {
  layoutMode?: JournalSpreadLayout
  magazinePageId: string
  rightMagazinePageId?: string
}

export interface CalculateDeliveryPayload {
  method: DeliveryMethod
  city: string
  address: string
  postalCode?: string
  recipientName: string
  recipientPhone: string
}

/** A page as already assembled client-side (a guest's local draft) — sent to `createDraft` so
 * the real order is created with exactly this content instead of fresh default pages. */
export interface CreateOrderJournalPagePayload {
  slotType: JournalSlotType
  layoutMode?: JournalSpreadLayout | null
  magazinePageId: string
  rightMagazinePageId?: string | null
  sortOrder: number
  pageSnapshot: CanvasData
}

export const ordersApi = {
  /** The account page's journal/order lists — `magazineType.coverImage` comes back already
   * resolved to an absolute URL server-side (see `OrdersService.withResolvedAssets`), no extra
   * client-side resolve needed here. */
  async list(page = 1, limit = 50): Promise<PaginatedOrders> {
    const { data } = await http.get<BackendResponse<PaginatedOrders>>('/orders', {
      params: { page, limit },
    })
    return data.data
  },

  /** Soft-deletes a draft journal — the backend rejects this for anything past `DRAFT`. */
  async remove(orderId: string): Promise<void> {
    await http.delete(`/orders/${orderId}`)
  },

  async createDraft(
    magazineTypeId: string,
    journalPages?: CreateOrderJournalPagePayload[],
  ): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>('/orders', {
      magazineTypeId,
      journalPages,
    })
    return data.data
  },

  async getOne(orderId: string): Promise<OrderDetail> {
    const { data } = await http.get<BackendResponse<OrderDetail>>(`/orders/${orderId}`)
    return data.data
  },

  async savePlaceholders(
    orderId: string,
    journalPageId: string,
    values: PlaceholderInput[],
  ): Promise<OrderDetail> {
    const { data } = await http.patch<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/journal-pages/${journalPageId}/placeholders`,
      { values },
    )
    return data.data
  },

  async submit(orderId: string): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>(`/orders/${orderId}/submit`)
    return data.data
  },

  /** Stubbed CDEK calculation — saves the delivery details on the order alongside the (fixed,
   * placeholder) price/eta the backend returns. See `CalculateDeliveryDto`. */
  async calculateDelivery(orderId: string, payload: CalculateDeliveryPayload): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/delivery/calculate`,
      payload,
    )
    return data.data
  },

  async applyPromoCode(orderId: string, code: string): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/promo-code`,
      { code },
    )
    return data.data
  },

  async removePromoCode(orderId: string): Promise<OrderDetail> {
    const { data } = await http.delete<BackendResponse<OrderDetail>>(`/orders/${orderId}/promo-code`)
    return data.data
  },

  async addJournalSpread(orderId: string): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/journal-spreads`,
    )
    return data.data
  },

  async reorderJournalSpreads(orderId: string, spreadIds: string[]): Promise<OrderDetail> {
    const { data } = await http.patch<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/journal-spreads/reorder`,
      { spreadIds },
    )
    return data.data
  },

  async setJournalPageTemplate(
    orderId: string,
    journalPageId: string,
    payload: SetJournalPageTemplatePayload,
  ): Promise<OrderDetail> {
    const { data } = await http.patch<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/journal-pages/${journalPageId}/template`,
      payload,
    )
    return data.data
  },

  /** Advanced per-element editor save — replaces the journal page's full document and clears any
   * simple-mode placeholder diffs (see backend `saveJournalPageCanvas`). */
  async saveJournalPageCanvas(
    orderId: string,
    journalPageId: string,
    canvasData: CanvasData,
  ): Promise<OrderDetail> {
    const { data } = await http.patch<BackendResponse<OrderDetail>>(
      `/orders/${orderId}/journal-pages/${journalPageId}/canvas`,
      { canvasData },
    )
    return data.data
  },
}

export const filesApi = {
  async uploadImage(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await http.post<BackendResponse<{ id: string; url: string }>>(
      '/files/image',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )

    const uploaded = data.data
    return {
      id: uploaded.id,
      url: resolveAssetUrl(uploaded.url) ?? uploaded.url,
    }
  },
}
