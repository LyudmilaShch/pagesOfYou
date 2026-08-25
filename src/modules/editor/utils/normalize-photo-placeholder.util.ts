import type { PageElement } from '../models'
import type {
  PhotoFitMode,
  PhotoFrameRef,
  PhotoPlaceholder,
  PhotoStrokePosition,
  PhotoStrokeStyle,
} from '../models/photo-placeholder.model'
import type { PhotoCorrectionParams, PhotoFilter, PhotoFilterPresetKey } from '../models/photo-filter.model'
import { PHOTO_CORRECTION_NEUTRAL } from '../models/photo-filter.model'
import type { PhotoMask, PhotoMaskType } from '../models/photo-mask.model'
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const PHOTO_FILTER_PRESET_KEYS = new Set<PhotoFilterPresetKey>([
  'editorial',
  'classic',
  'soft',
  'warm',
  'vintage',
  'film',
  'bw',
  'pastel',
  'love',
])

function normalizePhotoCorrection(value: unknown): PhotoCorrectionParams {
  const candidate = (value && typeof value === 'object' ? value : {}) as Partial<PhotoCorrectionParams>
  return {
    brightness: isFiniteNumber(candidate.brightness) ? candidate.brightness : PHOTO_CORRECTION_NEUTRAL.brightness,
    contrast: isFiniteNumber(candidate.contrast) ? candidate.contrast : PHOTO_CORRECTION_NEUTRAL.contrast,
    saturation: isFiniteNumber(candidate.saturation) ? candidate.saturation : PHOTO_CORRECTION_NEUTRAL.saturation,
    temperature: isFiniteNumber(candidate.temperature) ? candidate.temperature : PHOTO_CORRECTION_NEUTRAL.temperature,
    hue: isFiniteNumber(candidate.hue) ? candidate.hue : PHOTO_CORRECTION_NEUTRAL.hue,
    blur: isFiniteNumber(candidate.blur) ? candidate.blur : PHOTO_CORRECTION_NEUTRAL.blur,
  }
}

function normalizePhotoFilter(value: unknown): PhotoFilter | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PhotoFilter>
  const preset =
    typeof candidate.preset === 'string' && PHOTO_FILTER_PRESET_KEYS.has(candidate.preset as PhotoFilterPresetKey)
      ? (candidate.preset as PhotoFilterPresetKey)
      : null

  return {
    preset,
    intensity: isFiniteNumber(candidate.intensity) ? Math.min(100, Math.max(0, candidate.intensity)) : 100,
    correction: normalizePhotoCorrection(candidate.correction),
  }
}

const PHOTO_MASK_GEOMETRIC_TYPES = new Set<PhotoMaskType>([
  'circle',
  'oval',
  'rectangle',
  'rounded-rectangle',
  'heart',
  'star',
  'diamond',
])

function isPhotoMaskPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') {
    return false
  }
  const point = value as { x?: unknown; y?: unknown }
  return isFiniteNumber(point.x) && isFiniteNumber(point.y)
}

function normalizePhotoMask(value: unknown): PhotoMask | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as { type?: unknown; name?: unknown; points?: unknown }

  if (candidate.type === 'custom') {
    if (!Array.isArray(candidate.points) || !candidate.points.every(isPhotoMaskPoint)) {
      return null
    }
    return {
      type: 'custom',
      name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'Своя маска',
      points: candidate.points as Array<{ x: number; y: number }>,
    }
  }

  return typeof candidate.type === 'string' && PHOTO_MASK_GEOMETRIC_TYPES.has(candidate.type as PhotoMaskType)
    ? { type: candidate.type as Exclude<PhotoMaskType, 'custom'> }
    : null
}

function normalizePhotoFrame(value: unknown): PhotoFrameRef | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const frame = value as Partial<PhotoFrameRef>

  if (
    typeof frame.imageUrl !== 'string' ||
    !frame.imageUrl.trim() ||
    !isFiniteNumber(frame.naturalWidth) ||
    !isFiniteNumber(frame.naturalHeight) ||
    !isFiniteNumber(frame.sliceTop) ||
    !isFiniteNumber(frame.sliceRight) ||
    !isFiniteNumber(frame.sliceBottom) ||
    !isFiniteNumber(frame.sliceLeft)
  ) {
    return null
  }

  return {
    imageUrl: toStoredAssetPath(frame.imageUrl) ?? frame.imageUrl.trim(),
    naturalWidth: frame.naturalWidth,
    naturalHeight: frame.naturalHeight,
    sliceTop: frame.sliceTop,
    sliceRight: frame.sliceRight,
    sliceBottom: frame.sliceBottom,
    sliceLeft: frame.sliceLeft,
    photoAreaTop: isFiniteNumber(frame.photoAreaTop) ? frame.photoAreaTop : 0,
    photoAreaRight: isFiniteNumber(frame.photoAreaRight) ? frame.photoAreaRight : 0,
    photoAreaBottom: isFiniteNumber(frame.photoAreaBottom) ? frame.photoAreaBottom : 0,
    photoAreaLeft: isFiniteNumber(frame.photoAreaLeft) ? frame.photoAreaLeft : 0,
  }
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
    imageRotation: typeof photo.imageRotation === 'number' && Number.isFinite(photo.imageRotation) ? photo.imageRotation : 0,
    frame: normalizePhotoFrame(photo.frame),
    filter: normalizePhotoFilter(photo.filter),
    mask: normalizePhotoMask(photo.mask),
  }
}

