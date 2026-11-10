import type {
  PhotoFitMode,
  PhotoFrameRef,
} from '../models/photo-placeholder.model'
import {
  clampPhotoCrop,
  computePhotoImageLayout,
  getPhotoCropState,
  resolvePhotoRenderFitMode,
  type PhotoCropState,
} from './photo-crop.util'
import { getPhotoRenderBox } from './photo-frame.util'

/**
 * Editor and PDF page units are CSS/PDF points: 72 points = 1 inch
 * (see `page.constants.ts` and the PDF export, which screenshots the page 1:1 into PDF points).
 */
export const PRINT_POINTS_PER_INCH = 72

/** Photo-print target. Not itself a warning threshold — kept beside the thresholds so they stay easy to retune. */
export const PRINT_DPI_TARGET = 300

/**
 * Below this, the placement is likely to look soft in print.
 * Artifact Uprising warns at ≤150; we warn strictly below 150 so 150–200 can stay the softer band.
 */
export const PRINT_DPI_POOR = 150

/** Below this, but at or above {@link PRINT_DPI_POOR}, show a softer warning. Blurb uses <250; we stay lighter. */
export const PRINT_DPI_SOFT = 200

/**
 * Upload-time check, used when the destination slot is not known yet.
 * A long side of 1200px is 4 inches at 300 DPI or 8 inches at 150 DPI — below that, a large
 * journal frame is likely to print soft. Does not block the upload.
 */
export const UPLOAD_MIN_LONG_SIDE_PX = 1200

/**
 * Stricter upload band: under ~4 inches even at 150 DPI. Still non-blocking; only the badge color changes.
 */
export const UPLOAD_POOR_LONG_SIDE_PX = 600

/** Hide the on-photo badge when the printed window is smaller than this — it would cover the photo. */
export const PRINT_RESOLUTION_BADGE_MIN_SLOT_PT = 36

export const PRINT_RESOLUTION_COLOR = {
  poor: '#d4532b',
  soft: '#e0a106',
} as const

export const PRINT_RESOLUTION_MESSAGE = {
  poor: 'Низкое разрешение: фото может получиться размытым при печати',
  soft: 'Разрешение ниже оптимального: при печати фото может быть чуть мягким',
} as const

export const UPLOAD_LOW_RESOLUTION_MESSAGE =
  'Маленькое фото: на крупном кадре может получиться размытым при печати'

export type PrintResolutionLevel = 'ok' | 'soft' | 'poor'

export function classifyPrintDpi(dpi: number): PrintResolutionLevel {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    return 'ok'
  }

  if (dpi < PRINT_DPI_POOR) {
    return 'poor'
  }

  if (dpi < PRINT_DPI_SOFT) {
    return 'soft'
  }

  return 'ok'
}

export function printResolutionMessage(
  level: Exclude<PrintResolutionLevel, 'ok'>,
): string {
  return PRINT_RESOLUTION_MESSAGE[level]
}

export function classifyUploadResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): PrintResolutionLevel {
  if (width == null || height == null || !(width > 0) || !(height > 0)) {
    return 'ok'
  }

  const longSide = Math.max(width, height)

  if (longSide < UPLOAD_POOR_LONG_SIDE_PX) {
    return 'poor'
  }

  if (longSide < UPLOAD_MIN_LONG_SIDE_PX) {
    return 'soft'
  }

  return 'ok'
}

export function uploadResolutionMessage(
  level: Exclude<PrintResolutionLevel, 'ok'>,
): string {
  return level === 'poor'
    ? PRINT_RESOLUTION_MESSAGE.poor
    : UPLOAD_LOW_RESOLUTION_MESSAGE
}

export interface PhotoPrintPlacement {
  position: { x: number; y: number }
  size: { width: number; height: number }
  /** Element rotation in degrees. Page-space anchoring is only valid when this is 0. */
  rotation?: number
  frame?: PhotoFrameRef | null
  fitMode?: PhotoFitMode
  cropX?: number
  cropY?: number
  imageScale?: number
}

export interface PhotoPrintPageBounds {
  width: number
  height: number
  /** When the preview is clipped to one half of a spread, keep the badge inside that half. */
  visibleHalf?: 'left' | 'right'
}

/**
 * Effective DPI of the pixels that actually cover the printed photo window.
 *
 * Cover (the default, and what `contain` is rendered as): the image keeps its aspect ratio and is
 * scaled with
 *
 *   pointsPerPixel = max(printWidth / imageWidth, printHeight / imageHeight) * imageScale
 *   dpi            = 72 / pointsPerPixel
 *
 * which is the source pixels along the side that fills the frame, divided by that side in inches.
 * Zoom (`imageScale` > 1) spends fewer source pixels on the same printed size, so DPI drops.
 * Panning does not: it only chooses which pixels, not how many cover the frame.
 *
 * Fill stretches the photo. The two axes then differ, and the warning uses the worse one.
 *
 * Returns null when the sizes are not usable.
 */
export function computePhotoEffectiveDpi(input: {
  imageWidth: number
  imageHeight: number
  printWidthPt: number
  printHeightPt: number
  fitMode?: PhotoFitMode
  crop?: PhotoCropState
}): number | null {
  const { imageWidth, imageHeight, printWidthPt, printHeightPt } = input

  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    printWidthPt <= 0 ||
    printHeightPt <= 0
  ) {
    return null
  }

  const fitMode = input.fitMode ?? 'cover'
  const crop = input.crop ?? { cropX: 0, cropY: 0, imageScale: 1 }

  if (resolvePhotoRenderFitMode(fitMode) === 'fill') {
    const dpiX = (imageWidth * PRINT_POINTS_PER_INCH) / printWidthPt
    const dpiY = (imageHeight * PRINT_POINTS_PER_INCH) / printHeightPt
    return Math.min(dpiX, dpiY)
  }

  // Same scale the canvas uses: imageScale is clamped to the crop range before the cover layout.
  const clamped = clampPhotoCrop(
    printWidthPt,
    printHeightPt,
    imageWidth,
    imageHeight,
    fitMode,
    crop,
  )
  const layout = computePhotoImageLayout(
    printWidthPt,
    printHeightPt,
    imageWidth,
    imageHeight,
    'cover',
    clamped,
  )

  if (!layout || layout.width <= 0) {
    return null
  }

  const pointsPerPixel = layout.width / imageWidth

  if (!(pointsPerPixel > 0)) {
    return null
  }

  return PRINT_POINTS_PER_INCH / pointsPerPixel
}

export interface PhotoResolutionBadge {
  /** Center of the badge, in the element's own coordinate space (page points). */
  x: number
  y: number
  radius: number
  /** On-page size of the photo window, in points. Callers can hide the badge when this is tiny on screen. */
  slotWidth: number
  slotHeight: number
  level: Exclude<PrintResolutionLevel, 'ok'>
  dpi: number
  message: string
  fill: string
}

interface PrintRect {
  x: number
  y: number
  width: number
  height: number
}

/** Intersection of a page-space rect with the trimmed page (and, optionally, one spread half). */
export function intersectPrintRect(
  rect: PrintRect,
  pageWidth: number,
  pageHeight: number,
  visibleHalf?: 'left' | 'right',
): PrintRect | null {
  let minX = 0
  let maxX = pageWidth

  if (visibleHalf === 'left') {
    maxX = pageWidth / 2
  } else if (visibleHalf === 'right') {
    minX = pageWidth / 2
  }

  const x1 = Math.max(rect.x, minX)
  const y1 = Math.max(rect.y, 0)
  const x2 = Math.min(rect.x + rect.width, maxX)
  const y2 = Math.min(rect.y + rect.height, pageHeight)
  const width = x2 - x1
  const height = y2 - y1

  if (width <= 0 || height <= 0) {
    return null
  }

  return { x: x1, y: y1, width, height }
}

/**
 * Badge geometry for one placed photo, or null when the placement is sharp enough (or not printed).
 * `page` is the page-space bounds of `placement.position`. Omit it for a nested element whose
 * position is parent-relative — the badge then sits in the photo window's own top-right corner.
 */
export function buildPhotoResolutionBadge(
  placement: PhotoPrintPlacement,
  image: { width: number; height: number },
  page?: PhotoPrintPageBounds,
): PhotoResolutionBadge | null {
  const window = getPhotoRenderBox(
    placement.frame,
    placement.size.width,
    placement.size.height,
  )
  const crop = getPhotoCropState({
    cropX: placement.cropX ?? 0,
    cropY: placement.cropY ?? 0,
    imageScale: placement.imageScale ?? 1,
  })
  const dpi = computePhotoEffectiveDpi({
    imageWidth: image.width,
    imageHeight: image.height,
    printWidthPt: window.width,
    printHeightPt: window.height,
    fitMode: placement.fitMode,
    crop,
  })

  if (dpi == null) {
    return null
  }

  const level = classifyPrintDpi(dpi)

  if (level === 'ok') {
    return null
  }

  const pageWindow: PrintRect = {
    x: placement.position.x + window.x,
    y: placement.position.y + window.y,
    width: window.width,
    height: window.height,
  }
  // A rotated element's local axes no longer line up with the page, so the badge stays in the
  // photo window's own top-right. Unrotated placements (the usual case, including full-bleed)
  // slide that corner onto the part of the window that actually survives the trim.
  const alignedWithPage = page != null && Math.abs(placement.rotation ?? 0) < 0.5
  const visible = alignedWithPage
    ? intersectPrintRect(pageWindow, page.width, page.height, page.visibleHalf)
    : pageWindow

  if (
    !visible ||
    visible.width < PRINT_RESOLUTION_BADGE_MIN_SLOT_PT ||
    visible.height < PRINT_RESOLUTION_BADGE_MIN_SLOT_PT
  ) {
    return null
  }

  const radius = Math.min(9, visible.width * 0.18, visible.height * 0.18)

  if (radius < 6) {
    return null
  }

  const inset = radius + 2
  const cornerX = alignedWithPage
    ? visible.x + visible.width - placement.position.x
    : window.x + window.width
  const cornerY = alignedWithPage ? visible.y - placement.position.y : window.y

  return {
    x: cornerX - inset,
    y: cornerY + inset,
    radius,
    slotWidth: visible.width,
    slotHeight: visible.height,
    level,
    dpi,
    message: printResolutionMessage(level),
    fill: PRINT_RESOLUTION_COLOR[level],
  }
}
