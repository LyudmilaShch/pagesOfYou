import type { PageElementBase } from './page-element.model'

export type PhotoFitMode = 'cover' | 'contain' | 'fill'
export type PhotoStrokeStyle = 'solid' | 'dashed'
export type PhotoStrokePosition = 'center' | 'inside' | 'outside'

export interface PhotoPlaceholder extends PageElementBase {
  type: 'photo-placeholder'
  label: string
  borderRadius: number
  fitMode: PhotoFitMode
  maxImages: number
  required: boolean
  defaultImageUrl?: string | null
  stroke: string
  strokeWidth: number
  strokeStyle: PhotoStrokeStyle
  strokePosition: PhotoStrokePosition
  /** Pan offset inside the frame (cover/contain) */
  cropX: number
  cropY: number
  /** Multiplier on top of fit scale (>= 1 for cover) */
  imageScale: number
}
