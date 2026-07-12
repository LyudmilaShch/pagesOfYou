export type PageBackgroundImageFit = 'cover' | 'fill'

export type SpreadBackgroundMode = 'spread' | 'per-page'

export type SpreadBackgroundSide = 'left' | 'right'

export const DEFAULT_PAGE_BACKGROUND_IMAGE_FIT: PageBackgroundImageFit = 'cover'

export const DEFAULT_SPREAD_BACKGROUND_MODE: SpreadBackgroundMode = 'spread'

export const SPREAD_BACKGROUND_MODE_OPTIONS = [
  {
    title: 'Весь разворот',
    shortTitle: 'Разворот',
    value: 'spread' as const,
    icon: 'mdi-book-open-page-variant-outline',
  },
  {
    title: 'Каждая страница',
    shortTitle: 'Страницы',
    value: 'per-page' as const,
    icon: 'mdi-view-column-outline',
  },
] as const

export const SPREAD_BACKGROUND_SIDE_OPTIONS = [
  { title: 'Левая страница', shortTitle: 'Левая', value: 'left' as const },
  { title: 'Правая страница', shortTitle: 'Правая', value: 'right' as const },
] as const

export const PAGE_BACKGROUND_IMAGE_FIT_OPTIONS = [
  { title: 'Cover', value: 'cover' as const },
  { title: 'Fill', value: 'fill' as const },
] as const

export function normalizePageBackgroundImageFit(value: unknown): PageBackgroundImageFit {
  if (value === 'fill') {
    return 'fill'
  }

  return DEFAULT_PAGE_BACKGROUND_IMAGE_FIT
}

export function normalizeSpreadBackgroundMode(value: unknown): SpreadBackgroundMode {
  if (value === 'per-page') {
    return 'per-page'
  }

  return DEFAULT_SPREAD_BACKGROUND_MODE
}

export interface PageBackgroundSettings {
  backgroundColor: string
  backgroundImageUrl: string | null
  backgroundImageFit: PageBackgroundImageFit
  backgroundImageCropX: number
  backgroundImageCropY: number
  backgroundImageScale: number
}

export function createDefaultPageBackgroundSettings(
  backgroundColor = '#FFFFFF',
): PageBackgroundSettings {
  return {
    backgroundColor,
    backgroundImageUrl: null,
    backgroundImageFit: DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
    backgroundImageCropX: 0,
    backgroundImageCropY: 0,
    backgroundImageScale: 1,
  }
}

export function normalizePageBackgroundSettings(
  partial: Partial<PageBackgroundSettings> | null | undefined,
  fallback?: Partial<PageBackgroundSettings>,
): PageBackgroundSettings {
  const base = createDefaultPageBackgroundSettings(
    typeof fallback?.backgroundColor === 'string' ? fallback.backgroundColor : '#FFFFFF',
  )
  const source = partial ?? {}

  const crop = getPageBackgroundCropState({
    cropX: source.backgroundImageCropX ?? fallback?.backgroundImageCropX,
    cropY: source.backgroundImageCropY ?? fallback?.backgroundImageCropY,
    imageScale: source.backgroundImageScale ?? fallback?.backgroundImageScale,
  })

  return {
    backgroundColor:
      typeof source.backgroundColor === 'string'
        ? source.backgroundColor
        : base.backgroundColor,
    backgroundImageUrl:
      typeof source.backgroundImageUrl === 'string'
        ? source.backgroundImageUrl
        : source.backgroundImageUrl === null
          ? null
          : fallback?.backgroundImageUrl ?? null,
    backgroundImageFit: normalizePageBackgroundImageFit(
      source.backgroundImageFit ?? fallback?.backgroundImageFit,
    ),
    backgroundImageCropX: crop.cropX,
    backgroundImageCropY: crop.cropY,
    backgroundImageScale: crop.imageScale,
  }
}

export interface PageBackgroundCropState {
  cropX: number
  cropY: number
  imageScale: number
}

export const DEFAULT_PAGE_BACKGROUND_CROP: PageBackgroundCropState = {
  cropX: 0,
  cropY: 0,
  imageScale: 1,
}

export function getPageBackgroundCropState(
  source: Partial<PageBackgroundCropState> | null | undefined,
): PageBackgroundCropState {
  return {
    cropX: typeof source?.cropX === 'number' ? source.cropX : 0,
    cropY: typeof source?.cropY === 'number' ? source.cropY : 0,
    imageScale:
      typeof source?.imageScale === 'number' && source.imageScale > 0 ? source.imageScale : 1,
  }
}
