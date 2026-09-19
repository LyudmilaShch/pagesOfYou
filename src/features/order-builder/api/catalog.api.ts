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
import type { AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'
import type { AdminCustomPhotoMask } from '@/shared/api/admin/custom-photo-masks.api'
import type { Question } from '../types/question.types'

interface CatalogMagazineType {
  id: string
  name: string
  slug: string
  description: string | null
  coverImage: string | null
  /** Prisma Decimal serialises as string over JSON */
  basePrice: string | null
  oldPrice: string | null
  includedSpreads: number
  pricePerExtraFourPages: string | null
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
    includedSpreads: item.includedSpreads,
    pricePerExtraFourPages: toNum(item.pricePerExtraFourPages),
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

  /** Read-only reflection of the admin photo frame library — used by the customer-facing
   * advanced page editor, which has no admin session. */
  async getPhotoFrames(): Promise<AdminPhotoFrame[]> {
    const { data } = await http.get<BackendResponse<AdminPhotoFrame[]>>('/catalog/photo-frames')
    return data.data.map((item) => ({
      ...item,
      imageUrl: resolveAssetUrl(item.imageUrl) ?? item.imageUrl,
    }))
  },

  /** Read-only reflection of the admin custom photo mask library — same reasoning as above. */
  async getCustomPhotoMasks(): Promise<AdminCustomPhotoMask[]> {
    const { data } = await http.get<BackendResponse<AdminCustomPhotoMask[]>>(
      '/catalog/custom-photo-masks',
    )
    return data.data
  },

  /** All questions of the magazine type — a question's wizard-step placement is derived on the
   * frontend from which page's canvas elements actually reference its key, not from the question
   * itself (a question has no page of its own, see `buildQuestionnaireFlow`). */
  async getQuestions(magazineTypeId: string): Promise<Question[]> {
    const { data } = await http.get<BackendResponse<Question[]>>(
      `/catalog/magazine-types/by-id/${magazineTypeId}/questions`,
    )
    return data.data
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
