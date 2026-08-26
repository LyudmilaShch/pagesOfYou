export type PhotoFilterPresetKey =
  | 'editorial'
  | 'classic'
  | 'soft'
  | 'warm'
  | 'vintage'
  | 'film'
  | 'bw'
  | 'pastel'
  | 'love'

export interface PhotoCorrectionParams {
  brightness: number
  contrast: number
  saturation: number
  temperature: number
  hue: number
  blur: number
}

export interface PhotoFilter {
  /** Which preset card was last picked; null when built up manually via the custom sliders. */
  preset: PhotoFilterPresetKey | null
  /** 0-100, meaningful only while `preset` is set — how strongly its correction is blended in. */
  intensity: number
  correction: PhotoCorrectionParams
}

export const PHOTO_CORRECTION_NEUTRAL: PhotoCorrectionParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  hue: 0,
  blur: 0,
}

export function lerpCorrection(
  from: PhotoCorrectionParams,
  to: PhotoCorrectionParams,
  t: number,
): PhotoCorrectionParams {
  const clampedT = Math.min(1, Math.max(0, t))
  return {
    brightness: from.brightness + (to.brightness - from.brightness) * clampedT,
    contrast: from.contrast + (to.contrast - from.contrast) * clampedT,
    saturation: from.saturation + (to.saturation - from.saturation) * clampedT,
    temperature: from.temperature + (to.temperature - from.temperature) * clampedT,
    hue: from.hue + (to.hue - from.hue) * clampedT,
    blur: from.blur + (to.blur - from.blur) * clampedT,
  }
}

export interface PhotoFilterPresetDef {
  key: PhotoFilterPresetKey
  label: string
  correction: PhotoCorrectionParams
}

export const PHOTO_FILTER_PRESETS: PhotoFilterPresetDef[] = [
  {
    key: 'editorial',
    label: 'Editorial',
    correction: { brightness: 4, contrast: 18, saturation: -12, temperature: -6, hue: 0, blur: 0 },
  },
  {
    key: 'classic',
    label: 'Classic',
    correction: { brightness: 2, contrast: 10, saturation: 6, temperature: 2, hue: 0, blur: 0 },
  },
  {
    key: 'soft',
    label: 'Soft',
    correction: { brightness: 10, contrast: -16, saturation: -10, temperature: 4, hue: 0, blur: 1 },
  },
  {
    key: 'warm',
    label: 'Warm',
    correction: { brightness: 4, contrast: 4, saturation: 10, temperature: 32, hue: 0, blur: 0 },
  },
  {
    key: 'vintage',
    label: 'Vintage',
    correction: { brightness: 2, contrast: -10, saturation: -26, temperature: 18, hue: 6, blur: 0 },
  },
  {
    key: 'film',
    label: 'Film',
    correction: { brightness: 0, contrast: 16, saturation: -8, temperature: 10, hue: 0, blur: 0 },
  },
  {
    key: 'bw',
    label: 'Black & White',
    correction: { brightness: 2, contrast: 12, saturation: -100, temperature: 0, hue: 0, blur: 0 },
  },
  {
    key: 'pastel',
    label: 'Pastel',
    correction: { brightness: 16, contrast: -12, saturation: -28, temperature: 6, hue: 0, blur: 0 },
  },
  {
    key: 'love',
    label: 'Love',
    correction: { brightness: 6, contrast: 2, saturation: 14, temperature: 22, hue: -6, blur: 0 },
  },
]

export function getPhotoFilterPresetDef(key: PhotoFilterPresetKey): PhotoFilterPresetDef {
  const def = PHOTO_FILTER_PRESETS.find((preset) => preset.key === key)
  if (!def) {
    throw new Error(`Unknown photo filter preset: ${key}`)
  }
  return def
}

/**
 * True once the live correction values diverge from what the selected preset's intensity blend
 * alone would produce (or when no preset was ever picked) — dragging the dedicated Intensity
 * slider never counts as "custom"; touching any slider in the separate custom-settings section
 * does, per the spec's "Пользовательский" label switch.
 */
export function isCustomPhotoFilter(filter: PhotoFilter): boolean {
  if (!filter.preset) {
    return true
  }

  const def = getPhotoFilterPresetDef(filter.preset)
  const expected = lerpCorrection(PHOTO_CORRECTION_NEUTRAL, def.correction, filter.intensity / 100)
  return (Object.keys(expected) as Array<keyof PhotoCorrectionParams>).some(
    (key) => Math.abs(expected[key] - filter.correction[key]) > 0.001,
  )
}

export function getPhotoFilterLabel(filter: PhotoFilter | null): string {
  if (!filter) {
    return 'Без фильтра'
  }

  if (filter.preset && !isCustomPhotoFilter(filter)) {
    return getPhotoFilterPresetDef(filter.preset).label
  }

  return 'Пользовательский'
}

/** CSS-only approximation of the Konva pixel filter, used purely for preset thumbnails/previews. */
export function getCssFilterPreview(correction: PhotoCorrectionParams): string {
  const brightness = 1 + correction.brightness / 200
  const contrast = 1 + correction.contrast / 100
  const saturate = Math.max(0, 1 + correction.saturation / 100)
  const warmSepia = correction.temperature > 0 ? (correction.temperature / 100) * 30 : 0
  const coolHue = correction.temperature < 0 ? (correction.temperature / 100) * 20 : 0
  const hueRotate = correction.hue + coolHue

  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hueRotate}deg) sepia(${warmSepia}%) blur(${correction.blur}px)`
}
