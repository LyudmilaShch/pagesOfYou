import { adminHttp } from '@/features/admin/api/admin-http'
import { resolveAssetUrl } from '@/shared/config/assets'
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

function withResolvedCoverImage(item: AdminMagazineType): AdminMagazineType {
  return {
    ...item,
    coverImage: resolveAssetUrl(item.coverImage),
  }
}

// ── API object ───────────────────────────────────────────────────────────────

export const adminMagazineTypesApi = {
  async list(query: MagazineTypesQuery = {}): Promise<PaginatedMagazineTypes> {
    const { data } = await adminHttp.get<BackendResponse<PaginatedMagazineTypes>>(
      '/admin/magazine-types',
      { params: query },
    )
    return {
      ...data.data,
      items: data.data.items.map(withResolvedCoverImage),
    }
  },

  async getOne(id: string): Promise<AdminMagazineType> {
    const { data } = await adminHttp.get<BackendResponse<AdminMagazineType>>(
      `/admin/magazine-types/${id}`,
    )
    return withResolvedCoverImage(data.data)
  },

  async create(payload: CreateMagazineTypePayload): Promise<AdminMagazineType> {
    const { data } = await adminHttp.post<BackendResponse<AdminMagazineType>>(
      '/admin/magazine-types',
      payload,
    )
    return withResolvedCoverImage(data.data)
  },

  async update(id: string, payload: UpdateMagazineTypePayload): Promise<AdminMagazineType> {
    const { data } = await adminHttp.patch<BackendResponse<AdminMagazineType>>(
      `/admin/magazine-types/${id}`,
      payload,
    )
    return withResolvedCoverImage(data.data)
  },

  async remove(id: string): Promise<void> {
    await adminHttp.delete(`/admin/magazine-types/${id}`)
  },
}
