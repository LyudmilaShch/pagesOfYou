import { adminHttp } from '@/features/admin/api/admin-http'
import type { BackendResponse } from '@/types/api.types'

export type PromoCodeDiscountType = 'PERCENT' | 'AMOUNT'

export interface AdminPromoCode {
  id: string
  code: string
  /** Prisma Decimal/nullable Int serialise as string/number over JSON — exactly one of these two
   * is non-null at any time. */
  discountPercent: number | null
  discountAmount: string | null
  isActive: boolean
  expiresAt: string | null
  usageLimit: number | null
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface PaginatedPromoCodes {
  items: AdminPromoCode[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PromoCodesQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'code' | 'createdAt' | 'expiresAt' | 'usageCount'
  sortOrder?: 'asc' | 'desc'
}

export interface PromoCodePayload {
  code: string
  discountType: PromoCodeDiscountType
  discountValue: number
  isActive?: boolean
  /** ISO datetime, or omit/undefined for no expiry */
  expiresAt?: string
  usageLimit?: number
}

export type UpdatePromoCodePayload = Partial<PromoCodePayload>

export const adminPromoCodesApi = {
  async list(query: PromoCodesQuery = {}): Promise<PaginatedPromoCodes> {
    const { data } = await adminHttp.get<BackendResponse<PaginatedPromoCodes>>(
      '/admin/promo-codes',
      { params: query },
    )
    return data.data
  },

  async create(payload: PromoCodePayload): Promise<AdminPromoCode> {
    const { data } = await adminHttp.post<BackendResponse<AdminPromoCode>>(
      '/admin/promo-codes',
      payload,
    )
    return data.data
  },

  async update(id: string, payload: UpdatePromoCodePayload): Promise<AdminPromoCode> {
    const { data } = await adminHttp.patch<BackendResponse<AdminPromoCode>>(
      `/admin/promo-codes/${id}`,
      payload,
    )
    return data.data
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/promo-codes/${id}`)
  },
}
