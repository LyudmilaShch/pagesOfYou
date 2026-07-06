import type { PhotoFitMode, PhotoPlaceholder } from '../models/photo-placeholder.model'

export interface PhotoCropState {
  cropX: number
  cropY: number
  imageScale: number
}

export interface PhotoImageLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface PhotoKonvaImageLayout {
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
}

export const DEFAULT_PHOTO_CROP: PhotoCropState = {
  cropX: 0,
  cropY: 0,
  imageScale: 1,
}

export const MIN_PHOTO_IMAGE_SCALE = 1
export const MAX_PHOTO_IMAGE_SCALE = 4

export type PhotoScaleCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const PHOTO_SCALE_CORNER_ANGLE_DEG: Record<PhotoScaleCorner, number> = {
  'top-left': 225,
  'top-right': 315,
  'bottom-right': 45,
  'bottom-left': 135,
}

const PHOTO_SCALE_ROTATED_CURSORS = [
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
] as const

export function getPhotoScaleCornerCursor(
  corner: PhotoScaleCorner,
  rotationDeg = 0,
): string {
  const angle =
    (PHOTO_SCALE_CORNER_ANGLE_DEG[corner] + rotationDeg + 360) % 360
  const index = Math.round(angle / 45) % PHOTO_SCALE_ROTATED_CURSORS.length

  return PHOTO_SCALE_ROTATED_CURSORS[index]
}

export function getImagePixelSize(image: HTMLImageElement): { width: number; height: number } {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  }
}

/** Photos always fill the frame; contain letterboxing is not used. */
export function resolvePhotoRenderFitMode(fitMode: PhotoFitMode | undefined): PhotoFitMode {
  if (fitMode === 'fill') {
    return 'fill'
  }

  return 'cover'
}

export function getPhotoCropState(photo: Pick<PhotoPlaceholder, 'cropX' | 'cropY' | 'imageScale'>): PhotoCropState {
  return {
    cropX: photo.cropX ?? 0,
    cropY: photo.cropY ?? 0,
    imageScale: photo.imageScale ?? 1,
  }
}

export function computePhotoImageLayout(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
): PhotoImageLayout | null {
  if (boxWidth <= 0 || boxHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null
  }

  if (fitMode === 'fill') {
    return {
      x: crop.cropX,
      y: crop.cropY,
      width: boxWidth,
      height: boxHeight,
    }
  }

  const baseScale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
  const scale = baseScale * crop.imageScale
  const width = imageWidth * scale
  const height = imageHeight * scale

  return {
    x: (boxWidth - width) / 2 + crop.cropX,
    y: (boxHeight - height) / 2 + crop.cropY,
    width,
    height,
  }
}

export function computePhotoKonvaImageLayout(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
): PhotoKonvaImageLayout | null {
  if (boxWidth <= 0 || boxHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null
  }

  const renderMode = resolvePhotoRenderFitMode(fitMode)

  if (renderMode === 'fill') {
    return {
      x: 0,
      y: 0,
      width: boxWidth,
      height: boxHeight,
      crop: {
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
      },
    }
  }

  const clampedCrop = clampPhotoCrop(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    fitMode,
    crop,
  )
  const layout = computePhotoImageLayout(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    'cover',
    clampedCrop,
  )

  if (!layout) {
    return null
  }

  const scale = layout.width / imageWidth
  const srcX = Math.max(0, -layout.x / scale)
  const srcY = Math.max(0, -layout.y / scale)
  const srcW = Math.min(imageWidth - srcX, boxWidth / scale)
  const srcH = Math.min(imageHeight - srcY, boxHeight / scale)

  return {
    x: 0,
    y: 0,
    width: boxWidth,
    height: boxHeight,
    crop: {
      x: srcX,
      y: srcY,
      width: Math.max(1, srcW),
      height: Math.max(1, srcH),
    },
  }
}

export function clampPhotoCrop(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
): PhotoCropState {
  const imageScale = Math.max(
    MIN_PHOTO_IMAGE_SCALE,
    Math.min(MAX_PHOTO_IMAGE_SCALE, crop.imageScale),
  )

  if (resolvePhotoRenderFitMode(fitMode) === 'fill') {
    return {
      cropX: 0,
      cropY: 0,
      imageScale: 1,
    }
  }

  const baseScale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
  const scale = baseScale * imageScale
  const width = imageWidth * scale
  const height = imageHeight * scale

  // Keep the image in cover mode: the frame must stay fully filled (no empty gaps).
  const minCropX = (boxWidth - width) / 2
  const maxCropX = (width - boxWidth) / 2
  const minCropY = (boxHeight - height) / 2
  const maxCropY = (height - boxHeight) / 2

  return {
    cropX: Math.max(minCropX, Math.min(maxCropX, crop.cropX ?? 0)),
    cropY: Math.max(minCropY, Math.min(maxCropY, crop.cropY ?? 0)),
    imageScale,
  }
}

export function computePhotoCropFromPanDelta(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
  deltaX: number,
  deltaY: number,
): PhotoCropState {
  return clampPhotoCrop(boxWidth, boxHeight, imageWidth, imageHeight, fitMode, {
    cropX: crop.cropX + deltaX,
    cropY: crop.cropY + deltaY,
    imageScale: crop.imageScale,
  })
}

export function pagePointToPhotoLocal(
  _boxWidth: number,
  _boxHeight: number,
  position: { x: number; y: number },
  rotation: number,
  pageX: number,
  pageY: number,
): { x: number; y: number } {
  const dx = pageX - position.x
  const dy = pageY - position.y

  if (Math.abs(rotation) < 0.001) {
    return { x: dx, y: dy }
  }

  const radians = (-rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  }
}

export function computePhotoCropZoomAtPoint(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
  focalX: number,
  focalY: number,
  scaleDelta: number,
): PhotoCropState {
  if (resolvePhotoRenderFitMode(fitMode) === 'fill') {
    return getPhotoCropState(crop)
  }

  const currentLayout = computePhotoImageLayout(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    'cover',
    crop,
  )

  if (!currentLayout) {
    return getPhotoCropState(crop)
  }

  const currentScale = currentLayout.width / imageWidth
  const sourceX = (focalX - currentLayout.x) / currentScale
  const sourceY = (focalY - currentLayout.y) / currentScale

  const nextImageScale = Math.max(
    MIN_PHOTO_IMAGE_SCALE,
    Math.min(MAX_PHOTO_IMAGE_SCALE, crop.imageScale + scaleDelta),
  )

  if (Math.abs(nextImageScale - crop.imageScale) < 0.001) {
    return clampPhotoCrop(
      boxWidth,
      boxHeight,
      imageWidth,
      imageHeight,
      fitMode,
      crop,
    )
  }

  const scaledCrop: PhotoCropState = {
    ...crop,
    imageScale: nextImageScale,
  }
  const nextLayout = computePhotoImageLayout(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    'cover',
    scaledCrop,
  )

  if (!nextLayout) {
    return clampPhotoCrop(
      boxWidth,
      boxHeight,
      imageWidth,
      imageHeight,
      fitMode,
      scaledCrop,
    )
  }

  const nextScale = nextLayout.width / imageWidth
  const nextX = focalX - sourceX * nextScale
  const nextY = focalY - sourceY * nextScale

  return clampPhotoCrop(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    fitMode,
    {
      cropX: nextX - (boxWidth - nextLayout.width) / 2,
      cropY: nextY - (boxHeight - nextLayout.height) / 2,
      imageScale: nextImageScale,
    },
  )
}

export function getPhotoLayoutCornerPosition(
  layout: PhotoImageLayout,
  corner: PhotoScaleCorner,
): { x: number; y: number } {
  switch (corner) {
    case 'top-left':
      return { x: layout.x, y: layout.y }
    case 'top-right':
      return { x: layout.x + layout.width, y: layout.y }
    case 'bottom-left':
      return { x: layout.x, y: layout.y + layout.height }
    case 'bottom-right':
      return { x: layout.x + layout.width, y: layout.y + layout.height }
  }
}

export function computePhotoCropFromCornerDrag(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  fitMode: PhotoFitMode,
  crop: PhotoCropState,
  corner: PhotoScaleCorner,
  dragX: number,
  dragY: number,
): PhotoCropState {
  if (resolvePhotoRenderFitMode(fitMode) === 'fill') {
    return getPhotoCropState(crop)
  }

  const currentLayout = computePhotoImageLayout(
    boxWidth,
    boxHeight,
    imageWidth,
    imageHeight,
    'cover',
    crop,
  )

  if (!currentLayout) {
    return getPhotoCropState(crop)
  }

  const topLeft = { x: currentLayout.x, y: currentLayout.y }
  const bottomRight = {
    x: currentLayout.x + currentLayout.width,
    y: currentLayout.y + currentLayout.height,
  }
  const topRight = { x: bottomRight.x, y: topLeft.y }
  const bottomLeft = { x: topLeft.x, y: bottomRight.y }

  let anchor: { x: number; y: number }
  let spanWidth: number
  let spanHeight: number

  switch (corner) {
    case 'bottom-right':
      anchor = topLeft
      spanWidth = dragX - anchor.x
      spanHeight = dragY - anchor.y
      break
    case 'top-left':
      anchor = bottomRight
      spanWidth = anchor.x - dragX
      spanHeight = anchor.y - dragY
      break
    case 'top-right':
      anchor = bottomLeft
      spanWidth = dragX - anchor.x
      spanHeight = anchor.y - dragY
      break
    case 'bottom-left':
      anchor = topRight
      spanWidth = anchor.x - dragX
      spanHeight = dragY - anchor.y
      break
  }

  const baseScale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
  const minSpanWidth = imageWidth * baseScale * MIN_PHOTO_IMAGE_SCALE
  const minSpanHeight = imageHeight * baseScale * MIN_PHOTO_IMAGE_SCALE
  const maxSpanWidth = imageWidth * baseScale * MAX_PHOTO_IMAGE_SCALE
  const maxSpanHeight = imageHeight * baseScale * MAX_PHOTO_IMAGE_SCALE

  spanWidth = Math.max(minSpanWidth, Math.min(maxSpanWidth, spanWidth))
  spanHeight = Math.max(minSpanHeight, Math.min(maxSpanHeight, spanHeight))

  const totalScale = Math.max(spanWidth / imageWidth, spanHeight / imageHeight)
  const width = imageWidth * totalScale
  const height = imageHeight * totalScale
  const imageScale = totalScale / baseScale

  let x: number
  let y: number

  switch (corner) {
    case 'bottom-right':
      x = anchor.x
      y = anchor.y
      break
    case 'top-left':
      x = anchor.x - width
      y = anchor.y - height
      break
    case 'top-right':
      x = anchor.x
      y = anchor.y - height
      break
    case 'bottom-left':
      x = anchor.x - width
      y = anchor.y
      break
  }

  return clampPhotoCrop(boxWidth, boxHeight, imageWidth, imageHeight, fitMode, {
    cropX: x - (boxWidth - width) / 2,
    cropY: y - (boxHeight - height) / 2,
    imageScale,
  })
}
