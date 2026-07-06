import { resolveAssetUrl } from '@/shared/config/assets'
import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'
import type { OrderDetail, PlaceholderInput } from '../types/order.types'
import type { JournalSpreadLayout } from '../constants/journal.constants'

export interface SetJournalPageTemplatePayload {
  layoutMode?: JournalSpreadLayout
  magazinePageId: string
  rightMagazinePageId?: string
}

export const ordersApi = {
  async createDraft(magazineTypeId: string): Promise<OrderDetail> {
    const { data } = await http.post<BackendResponse<OrderDetail>>('/orders', {
      magazineTypeId,
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
