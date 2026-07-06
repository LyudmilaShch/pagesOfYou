/**
 * Public Catalog API — used by the order builder (frontend, unauthenticated).
 *
 * GET /catalog/magazine-types returns only active, non-deleted types
 * sorted by sortOrder ASC (server-side).
 */

import { resolveAssetUrl } from '@/shared/config/assets'
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
    image: resolveAssetUrl(item.coverImage) ?? '',
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

  async getMagazinePages(magazineTypeId: string): Promise<CatalogMagazinePage[]> {
    const { data } = await http.get<BackendResponse<CatalogMagazinePage[]>>(
      `/catalog/magazine-types/by-id/${magazineTypeId}/pages`,
    )

    return data.data.map((page) => ({
      ...page,
      previewImage: resolveAssetUrl(page.previewImage),
    }))
  },

  async getDefaultSpreads(magazineTypeId: string): Promise<CatalogDefaultSpread[]> {
    const { data } = await http.get<BackendResponse<CatalogDefaultSpread[]>>(
      `/catalog/magazine-types/by-id/${magazineTypeId}/default-spreads`,
    )

    return data.data.map((spread) => ({
      ...spread,
      magazinePage: {
        ...spread.magazinePage,
        previewImage: resolveAssetUrl(spread.magazinePage.previewImage),
      },
      rightMagazinePage: spread.rightMagazinePage
        ? {
            ...spread.rightMagazinePage,
            previewImage: resolveAssetUrl(spread.rightMagazinePage.previewImage),
          }
        : null,
    }))
  },
}

export interface CatalogMagazinePage {
  id: string
  name: string
  description: string | null
  pageType: string
  sortOrder: number
  previewImage: string | null
  canvasData: unknown
  isRequired: boolean
}

export interface CatalogDefaultSpread {
  id: string
  sortOrder: number
  layoutMode: string
  magazinePageId: string
  rightMagazinePageId: string | null
  magazinePage: {
    id: string
    name: string
    pageType: string
    previewImage: string | null
  }
  rightMagazinePage: {
    id: string
    name: string
    pageType: string
    previewImage: string | null
  } | null
}
