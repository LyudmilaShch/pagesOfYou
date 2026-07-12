import type { PageElement } from '../models'
import type {
  PhotoFitMode,
  PhotoPlaceholder,
  PhotoStrokePosition,
  PhotoStrokeStyle,
} from '../models/photo-placeholder.model'
import { toStoredAssetPath } from '@/shared/config/assets'
import {
  normalizePhotoStrokePosition,
  normalizePhotoStrokeStyle,
  normalizePhotoStrokeWidth,
} from './element-stroke.util'

const PHOTO_FIT_MODES = new Set<PhotoFitMode>(['cover', 'contain', 'fill'])

type LegacyPhotoPlaceholder = PhotoPlaceholder & {
  strokes?: Array<{
    color?: string
    width?: number
    style?: PhotoStrokeStyle
    position?: PhotoStrokePosition
  }>
  url?: string | null
  imageUrl?: string | null
  image?: string | null
  src?: string | null
}

function resolveStoredDefaultImageUrl(photo: LegacyPhotoPlaceholder): string | null {
  const candidates = [
    photo.defaultImageUrl,
    photo.url,
    photo.imageUrl,
    photo.image,
    photo.src,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return toStoredAssetPath(value) ?? value.trim()
    }
  }

  return null
}

function resolveInitialPhotoStroke(photo: LegacyPhotoPlaceholder) {
  const legacyStroke = Array.isArray(photo.strokes) ? photo.strokes[0] : undefined

  if (legacyStroke) {
    return {
      stroke:
        typeof legacyStroke.color === 'string' && legacyStroke.color.trim()
          ? legacyStroke.color
          : '#111111',
      strokeWidth: normalizePhotoStrokeWidth(legacyStroke.width, 0),
      strokeStyle: normalizePhotoStrokeStyle(legacyStroke.style),
      strokePosition: normalizePhotoStrokePosition(legacyStroke.position),
    }
  }

  return {
    stroke: typeof photo.stroke === 'string' && photo.stroke.trim() ? photo.stroke : '#111111',
    strokeWidth: normalizePhotoStrokeWidth(photo.strokeWidth, 0),
    strokeStyle: normalizePhotoStrokeStyle(photo.strokeStyle),
    strokePosition: normalizePhotoStrokePosition(photo.strokePosition),
  }
}

export function normalizePhotoPlaceholderElement(element: PageElement): PageElement {
  if (element.type !== 'photo-placeholder') {
    return element
  }

  const photo = element as LegacyPhotoPlaceholder
  const stroke = resolveInitialPhotoStroke(photo)

  return {
    ...photo,
    fitMode:
      photo.fitMode && PHOTO_FIT_MODES.has(photo.fitMode) && photo.fitMode !== 'contain'
        ? photo.fitMode
        : 'cover',
    defaultImageUrl: resolveStoredDefaultImageUrl(photo),
    ...stroke,
    cropX: typeof photo.cropX === 'number' ? photo.cropX : 0,
    cropY: typeof photo.cropY === 'number' ? photo.cropY : 0,
    imageScale:
      typeof photo.imageScale === 'number' && photo.imageScale > 0 ? photo.imageScale : 1,
  }
}

