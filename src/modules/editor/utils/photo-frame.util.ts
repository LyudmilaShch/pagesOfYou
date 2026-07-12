import type { PhotoFrameRef } from '../models/photo-placeholder.model'

export interface NineSliceImageConfig {
  crop: { x: number; y: number; width: number; height: number }
  x: number
  y: number
  width: number
  height: number
}

export interface PhotoRenderBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Piecewise-linear projection of a single natural-PNG-px coordinate onto the
 * rendered box along one axis, using the same clamped 9-slice zones as
 * `buildFrameNineSliceConfigs` (corner zones scale uniformly, the stretchy
 * middle zone scales linearly). Shared so any point in the frame's source
 * coordinate space — not just the 3 slice breakpoints — maps consistently.
 */
function mapAxisValue(
  value: number,
  sliceStart: number,
  sliceEnd: number,
  natural: number,
  box: number,
): number {
  const scale = sliceStart + sliceEnd > box ? box / (sliceStart + sliceEnd) : 1
  const targetStart = sliceStart * scale
  const targetEnd = sliceEnd * scale

  if (value <= sliceStart) {
    return value * scale
  }

  if (value >= natural - sliceEnd) {
    return box - targetEnd + (value - (natural - sliceEnd)) * scale
  }

  const middleNatural = Math.max(0, natural - sliceStart - sliceEnd)
  const middleTarget = Math.max(0, box - targetStart - targetEnd)
  const ratio = middleNatural > 0 ? (value - sliceStart) / middleNatural : 0

  return targetStart + ratio * middleTarget
}

/**
 * Splits a decorative frame image into up to 9 crop/position regions so its
 * corners stay a fixed size while edges/center stretch to fill the box
 * (mirrors CSS `border-image`). Insets are clamped proportionally when the
 * box is smaller than the combined slice thickness, so corners never overlap.
 */
export function buildFrameNineSliceConfigs(
  frame: PhotoFrameRef,
  boxWidth: number,
  boxHeight: number,
): NineSliceImageConfig[] {
  if (boxWidth <= 0 || boxHeight <= 0 || frame.naturalWidth <= 0 || frame.naturalHeight <= 0) {
    return []
  }

  const targetLeft = mapAxisValue(frame.sliceLeft, frame.sliceLeft, frame.sliceRight, frame.naturalWidth, boxWidth)
  const targetRight =
    boxWidth -
    mapAxisValue(frame.naturalWidth - frame.sliceRight, frame.sliceLeft, frame.sliceRight, frame.naturalWidth, boxWidth)
  const targetTop = mapAxisValue(frame.sliceTop, frame.sliceTop, frame.sliceBottom, frame.naturalHeight, boxHeight)
  const targetBottom =
    boxHeight -
    mapAxisValue(frame.naturalHeight - frame.sliceBottom, frame.sliceTop, frame.sliceBottom, frame.naturalHeight, boxHeight)

  const columns = [
    { srcX: 0, srcWidth: frame.sliceLeft, x: 0, width: targetLeft },
    {
      srcX: frame.sliceLeft,
      srcWidth: Math.max(0, frame.naturalWidth - frame.sliceLeft - frame.sliceRight),
      x: targetLeft,
      width: Math.max(0, boxWidth - targetLeft - targetRight),
    },
    {
      srcX: frame.naturalWidth - frame.sliceRight,
      srcWidth: frame.sliceRight,
      x: boxWidth - targetRight,
      width: targetRight,
    },
  ]

  const rows = [
    { srcY: 0, srcHeight: frame.sliceTop, y: 0, height: targetTop },
    {
      srcY: frame.sliceTop,
      srcHeight: Math.max(0, frame.naturalHeight - frame.sliceTop - frame.sliceBottom),
      y: targetTop,
      height: Math.max(0, boxHeight - targetTop - targetBottom),
    },
    {
      srcY: frame.naturalHeight - frame.sliceBottom,
      srcHeight: frame.sliceBottom,
      y: boxHeight - targetBottom,
      height: targetBottom,
    },
  ]

  const configs: NineSliceImageConfig[] = []

  for (const row of rows) {
    if (row.height <= 0 || row.srcHeight <= 0) {
      continue
    }

    for (const column of columns) {
      if (column.width <= 0 || column.srcWidth <= 0) {
        continue
      }

      configs.push({
        crop: { x: column.srcX, y: row.srcY, width: column.srcWidth, height: row.srcHeight },
        x: column.x,
        y: row.y,
        width: column.width,
        height: row.height,
      })
    }
  }

  return configs
}

/**
 * Maps the frame's admin-defined photo window (insets in the source PNG's
 * coordinate space) onto the rendered box using simple linear percentage
 * scaling — deliberately independent of the 9-slice corner clamping used
 * for the frame's own decorative artwork.
 *
 * The admin form's preview shows the window as a straight `inset / natural`
 * percentage of the raw image, so the render must match that 1:1 — reusing
 * the slice-clamped scale here would tie the photo window to the frame's
 * corner math, and when slice insets are large relative to the element's
 * on-page size (a very common case — frames are authored at high PNG
 * resolution, placeholders default to ~200px), the clamped "stretchy middle"
 * collapses toward zero width and the window collapses with it.
 */
export function mapFramePhotoArea(
  frame: PhotoFrameRef,
  boxWidth: number,
  boxHeight: number,
): PhotoRenderBox | null {
  if (boxWidth <= 0 || boxHeight <= 0 || frame.naturalWidth <= 0 || frame.naturalHeight <= 0) {
    return null
  }

  const x1 = (frame.photoAreaLeft / frame.naturalWidth) * boxWidth
  const x2 = boxWidth - (frame.photoAreaRight / frame.naturalWidth) * boxWidth
  const y1 = (frame.photoAreaTop / frame.naturalHeight) * boxHeight
  const y2 = boxHeight - (frame.photoAreaBottom / frame.naturalHeight) * boxHeight

  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) }
}

/**
 * Single source of truth for where a photo-placeholder's photo (crop, pan,
 * scale handles, empty state, crop editor…) should be rendered/interacted
 * with: the full element box, or — when a frame with a photo window is set —
 * that window, mapped onto the element's current size.
 */
export function getPhotoRenderBox(
  frame: PhotoFrameRef | null | undefined,
  elementWidth: number,
  elementHeight: number,
): PhotoRenderBox {
  const area = frame ? mapFramePhotoArea(frame, elementWidth, elementHeight) : null

  if (area && area.width > 0 && area.height > 0) {
    return area
  }

  return { x: 0, y: 0, width: elementWidth, height: elementHeight }
}
