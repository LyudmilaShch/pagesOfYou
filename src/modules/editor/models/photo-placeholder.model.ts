import type { PageElementBase } from './page-element.model'

export type PhotoFitMode = 'cover' | 'contain' | 'fill'
export type PhotoStrokeStyle = 'solid' | 'dashed'
export type PhotoStrokePosition = 'center' | 'inside' | 'outside'

/** Decorative 9-slice frame, copied from the PhotoFrame catalog when selected. */
export interface PhotoFrameRef {
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  sliceTop: number
  sliceRight: number
  sliceBottom: number
  sliceLeft: number
  /** Photo window insets (source PNG px) — where the photo may be positioned within the frame. */
  photoAreaTop: number
  photoAreaRight: number
  photoAreaBottom: number
  photoAreaLeft: number
}

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
  /** Decorative frame overlay; when set, the plain stroke is not rendered */
  frame?: PhotoFrameRef | null
}
