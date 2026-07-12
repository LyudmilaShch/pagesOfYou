import type { PageBackgroundImageFit } from '../models/page-background.model'
import { getPageBackgroundCropState } from '../models/page-background.model'
import type { PhotoCropState } from './photo-crop.util'
import {
  computePhotoKonvaImageLayout,
  getImagePixelSize,
  resolvePhotoRenderFitMode,
} from './photo-crop.util'

export interface PageBackgroundImageKonvaConfig {
  x: number
  y: number
  width: number
  height: number
  crop: {
    x: number
    y: number
    width: number
    height: number
  }
  listening: false
}

export function computePageBackgroundImageKonvaConfig(
  pageWidth: number,
  pageHeight: number,
  image: HTMLImageElement,
  fitMode: PageBackgroundImageFit,
  crop: Partial<PhotoCropState> | null | undefined,
): PageBackgroundImageKonvaConfig | null {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return null
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(image)

  if (imageWidth <= 0 || imageHeight <= 0) {
    return null
  }

  const layout = computePhotoKonvaImageLayout(
    pageWidth,
    pageHeight,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(fitMode),
    getPageBackgroundCropState(crop),
  )

  if (!layout) {
    return null
  }

  return {
    ...layout,
    listening: false,
  }
}
