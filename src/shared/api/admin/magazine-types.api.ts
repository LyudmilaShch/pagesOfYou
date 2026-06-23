import { adminHttp } from '@/features/admin/api/admin-http'
import type { BackendResponse } from '@/types/api.types'

// ── Types ────────────────────────────────────────────────────────────────────

export type BadgeType = 'TOP' | 'NEW' | 'SALE' | 'POPULAR' | 'LIMITED'

export interface AdminMagazineType {
  id: string
  name: string
  slug: string
  description: string | null
  coverImage: string | null
  /** Prisma Decimal serialises as string over JSON */
  basePrice: string | null
  oldPrice: string | null
  badgeType: BadgeType | null
  badgeText: string | null
  isActive: boolean
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PaginatedMagazineTypes {
  items: AdminMagazineType[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface MagazineTypesQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'name' | 'sortOrder' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateMagazineTypePayload {
  name: string
  slug: string
  description?: string
  coverImage?: string
  basePrice?: number
  oldPrice?: number
  badgeType?: BadgeType
  badgeText?: string
  isActive?: boolean
  sortOrder?: number
  seoTitle?: string
  seoDescription?: string
}

export type UpdateMagazineTypePayload = Partial<CreateMagazineTypePayload>

// ── API object ───────────────────────────────────────────────────────────────

export const adminMagazineTypesApi = {
  async list(query: MagazineTypesQuery = {}): Promise<PaginatedMagazineTypes> {
    const { data } = await adminHttp.get<BackendResponse<PaginatedMagazineTypes>>(
      '/admin/magazine-types',
      { params: query },
    )
    return data.data
  },

  async getOne(id: string): Promise<AdminMagazineType> {
    const { data } = await adminHttp.get<BackendResponse<AdminMagazineType>>(
      `/admin/magazine-types/${id}`,
    )
    return data.data
  },

  async create(payload: CreateMagazineTypePayload): Promise<AdminMagazineType> {
    const { data } = await adminHttp.post<BackendResponse<AdminMagazineType>>(
      '/admin/magazine-types',
      payload,
    )
    return data.data
  },

  async update(id: string, payload: UpdateMagazineTypePayload): Promise<AdminMagazineType> {
    const { data } = await adminHttp.patch<BackendResponse<AdminMagazineType>>(
      `/admin/magazine-types/${id}`,
      payload,
    )
    return data.data
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/magazine-types/${id}`)
  },
}
