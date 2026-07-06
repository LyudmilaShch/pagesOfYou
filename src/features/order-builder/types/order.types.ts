import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { JournalSpreadLayout, JournalSlotType } from '../constants/journal.constants'

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
  textAlign?: 'left' | 'center' | 'right'
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
  }
  journalPages: JournalPage[]
}

export interface PlaceholderInput {
  elementId: string
  valueType: PlaceholderValueType
  textValue?: string
  jsonValue?: PlaceholderJsonValue
}
