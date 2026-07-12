import { A4_PAGE_WIDTH } from '../constants/page.constants'
import type { CanvasData } from '../models/canvas-data.model'
import {
  createDefaultPageBackgroundSettings,
  normalizePageBackgroundSettings,
  normalizeSpreadBackgroundMode,
  type PageBackgroundSettings,
  type SpreadBackgroundMode,
  type SpreadBackgroundSide,
} from '../models/page-background.model'
import { isSpreadCanvas } from './spread.util'

export interface SpreadBackgroundRenderLayer {
  key: 'spread' | SpreadBackgroundSide
  x: number
  width: number
  settings: PageBackgroundSettings
}

export function resolveSpreadBackgroundMode(canvas: Pick<CanvasData, 'spreadBackgroundMode' | 'pageWidth' | 'pageHeight'>): SpreadBackgroundMode {
  if (!isSpreadCanvas(canvas.pageWidth ?? 0, canvas.pageHeight ?? 0)) {
    return 'spread'
  }

  return normalizeSpreadBackgroundMode(canvas.spreadBackgroundMode)
}

export function getRootPageBackgroundSettings(canvas: CanvasData): PageBackgroundSettings {
  return normalizePageBackgroundSettings({
    backgroundColor: canvas.backgroundColor,
    backgroundImageUrl: canvas.backgroundImageUrl,
    backgroundImageFit: canvas.backgroundImageFit,
    backgroundImageCropX: canvas.backgroundImageCropX,
    backgroundImageCropY: canvas.backgroundImageCropY,
    backgroundImageScale: canvas.backgroundImageScale,
  })
}

export function getSpreadPageBackgroundSettings(
  canvas: CanvasData,
  side: SpreadBackgroundSide,
): PageBackgroundSettings {
  const root = getRootPageBackgroundSettings(canvas)
  const partial = side === 'left' ? canvas.leftPageBackground : canvas.rightPageBackground

  return normalizePageBackgroundSettings(partial, root)
}

export function getSpreadBackgroundRenderLayers(canvas: CanvasData): SpreadBackgroundRenderLayer[] {
  const pageHeight = canvas.pageHeight ?? 842
  const spreadWidth = canvas.pageWidth ?? A4_PAGE_WIDTH * 2

  if (!isSpreadCanvas(spreadWidth, pageHeight)) {
    const settings = getRootPageBackgroundSettings(canvas)

    return [
      {
        key: 'spread',
        x: 0,
        width: spreadWidth,
        settings,
      },
    ]
  }

  if (resolveSpreadBackgroundMode(canvas) === 'per-page') {
    return [
      {
        key: 'left',
        x: 0,
        width: A4_PAGE_WIDTH,
        settings: getSpreadPageBackgroundSettings(canvas, 'left'),
      },
      {
        key: 'right',
        x: A4_PAGE_WIDTH,
        width: A4_PAGE_WIDTH,
        settings: getSpreadPageBackgroundSettings(canvas, 'right'),
      },
    ]
  }

  return [
    {
      key: 'spread',
      x: 0,
      width: spreadWidth,
      settings: getRootPageBackgroundSettings(canvas),
    },
  ]
}

export function getEditablePageBackgroundSettings(
  canvas: CanvasData,
  options: {
    isSpreadPage: boolean
    spreadBackgroundMode: SpreadBackgroundMode
    activeSide: SpreadBackgroundSide
  },
): PageBackgroundSettings {
  if (!options.isSpreadPage || options.spreadBackgroundMode === 'spread') {
    return getRootPageBackgroundSettings(canvas)
  }

  return getSpreadPageBackgroundSettings(canvas, options.activeSide)
}

export function clonePageBackgroundSettings(
  settings: PageBackgroundSettings,
): PageBackgroundSettings {
  return { ...settings }
}

export function createPerPageBackgroundsFromRoot(canvas: CanvasData): {
  leftPageBackground: PageBackgroundSettings
  rightPageBackground: PageBackgroundSettings
} {
  const root = getRootPageBackgroundSettings(canvas)

  return {
    leftPageBackground: clonePageBackgroundSettings(root),
    rightPageBackground: clonePageBackgroundSettings(root),
  }
}

export function createDefaultSpreadSideBackgrounds(): {
  leftPageBackground: PageBackgroundSettings
  rightPageBackground: PageBackgroundSettings
} {
  const defaults = createDefaultPageBackgroundSettings()

  return {
    leftPageBackground: clonePageBackgroundSettings(defaults),
    rightPageBackground: clonePageBackgroundSettings(defaults),
  }
}
