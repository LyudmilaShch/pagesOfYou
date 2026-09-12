import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { JournalSpreadLayout, JournalSlotType } from '../constants/journal.constants'
import type { OrderStatus } from '../constants/order-status.constants'

export type PlaceholderValueType = 'TEXT' | 'PHOTO' | 'DATE'

export interface PlaceholderJsonValue {
  url?: string
  cropX?: number
  cropY?: number
  imageScale?: number
  fitMode?: 'cover' | 'fill'
  borderRadius?: number
  position?: { x?: number; y?: number }
  size?: { width?: number; height?: number }
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontItalic?: boolean
  textTransform?: 'none' | 'uppercase'
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  letterSpacing?: number
  lineHeight?: number
  verticalAlign?: 'top' | 'middle' | 'bottom'
  color?: string
  rotation?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed'
  strokePosition?: 'center' | 'inside' | 'outside'
  /** @deprecated Legacy multi-stroke format */
  strokes?: Array<{
    color?: string
    width?: number
    style?: 'solid' | 'dashed'
    position?: 'center' | 'inside' | 'outside'
  }>
}

export interface PlaceholderValue {
  id: string
  elementId: string
  valueType: PlaceholderValueType
  textValue: string | null
  jsonValue: PlaceholderJsonValue | null
}

export interface MagazinePageSummary {
  id: string
  name: string
  pageType: string
  previewImage: string | null
  isRequired: boolean
}

export interface JournalPage {
  id: string
  sortOrder: number
  slotType: JournalSlotType
  layoutMode: JournalSpreadLayout | null
  pageSnapshot: CanvasData
  magazinePage: MagazinePageSummary
  rightMagazinePage?: MagazinePageSummary | null
  placeholderValues: PlaceholderValue[]
}

export type DeliveryMethod = 'PICKUP_POINT' | 'COURIER'

export interface OrderDetail {
  id: string
  status: string
  magazineTypeId: string
  totalPrice: string | null
  magazineType: {
    id: string
    name: string
    slug: string
    coverImage: string | null
    basePrice: string | null
    oldPrice: string | null
    includedSpreads: number
    pricePerExtraFourPages: string | null
  }
  journalPages: JournalPage[]
  deliveryMethod: DeliveryMethod | null
  deliveryCity: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  recipientName: string | null
  recipientPhone: string | null
  deliveryPrice: string | null
  deliveryEtaDays: number | null
  promoCode: { code: string } | null
  discountAmount: string | null
}

export interface PlaceholderInput {
  elementId: string
  valueType: PlaceholderValueType
  textValue?: string
  jsonValue?: PlaceholderJsonValue
}

/** One row of the account page's journal/order lists — a lighter shape than `OrderDetail`
 * (only the cover `journalPage`, not the full list), matching what `GET /orders`
 * (`OrdersService.findAllByUser`) actually returns. `status === 'DRAFT'` means this is still an
 * in-progress journal, not a placed order. */
export interface OrderSummary {
  id: string
  status: OrderStatus
  totalPrice: string | null
  createdAt: string
  submittedAt: string | null
  updatedAt: string
  magazineType: {
    id: string
    name: string
    coverImage: string | null
  }
  /** The journal's own COVER page (at most one item — the backend query already filters to
   * `slotType: COVER, take: 1`) — rendered via `JournalSpreadThumbnail` for a real thumbnail (the
   * customer's actual cover design), instead of `magazineType.coverImage`'s generic catalog photo
   * for the magazine *type*. Empty only for a malformed order with no cover slot at all. */
  journalPages: Array<{
    id: string
    pageSnapshot: CanvasData
    placeholderValues: PlaceholderValue[]
  }>
}

export interface PaginatedOrders {
  items: OrderSummary[]
  total: number
  page: number
  limit: number
}
