/**
 * Public Catalog API — used by the order builder (frontend, unauthenticated).
 *
 * GET /catalog/magazine-types returns only active, non-deleted types
 * sorted by sortOrder ASC (server-side).
 */

import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'
import type { MagazineType } from '../types/magazine-type'

interface CatalogMagazineType {
  id: string
  name: string
  slug: string
  description: string | null
  coverImage: string | null
  /** Prisma Decimal serialises as string over JSON */
  basePrice: string | null
  oldPrice: string | null
  badgeType: string | null
  badgeText: string | null
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
}

function toNum(v: string | null): number | null {
  return v != null ? parseFloat(v) : null
}

function toDomain(item: CatalogMagazineType): MagazineType {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    image: item.coverImage ?? '',
    basePrice: toNum(item.basePrice),
    oldPrice: toNum(item.oldPrice),
    badgeType: item.badgeType as MagazineType['badgeType'],
    badgeText: item.badgeText,
    sortOrder: item.sortOrder,
  }
}

export const catalogApi = {
  async getMagazineTypes(): Promise<MagazineType[]> {
    const { data } = await http.get<BackendResponse<CatalogMagazineType[]>>(
      '/catalog/magazine-types',
    )
    return data.data.map(toDomain)
  },
}
