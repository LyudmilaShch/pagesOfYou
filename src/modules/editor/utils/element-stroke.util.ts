import type { PageElement } from '../models'
import type {
  PhotoPlaceholder,
  PhotoStrokePosition,
  PhotoStrokeStyle,
} from '../models/photo-placeholder.model'
import {
  PHOTO_BORDER_STROKE_WIDTH_MAX,
  PHOTO_BORDER_STROKE_WIDTH_MIN,
} from '../constants/page.constants'

const STROKE_LINE_STYLES = new Set<PhotoStrokeStyle>(['solid', 'dashed'])
const STROKE_POSITIONS = new Set<PhotoStrokePosition>(['center', 'inside', 'outside'])

export function normalizePhotoStrokeStyle(value: unknown, fallback: PhotoStrokeStyle = 'solid'): PhotoStrokeStyle {
  return value && STROKE_LINE_STYLES.has(value as PhotoStrokeStyle)
    ? (value as PhotoStrokeStyle)
    : fallback
}

export function normalizePhotoStrokePosition(
  value: unknown,
  fallback: PhotoStrokePosition = 'center',
): PhotoStrokePosition {
  return value && STROKE_POSITIONS.has(value as PhotoStrokePosition)
    ? (value as PhotoStrokePosition)
    : fallback
}

export function normalizePhotoStrokeWidth(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(
    PHOTO_BORDER_STROKE_WIDTH_MAX,
    Math.max(PHOTO_BORDER_STROKE_WIDTH_MIN, Math.round(value)),
  )
}

export function hasPhotoStroke(photo: PhotoPlaceholder): boolean {
  return photo.strokeWidth > 0
}

export function getPhotoStrokeDash(style: PhotoStrokeStyle, width: number): number[] | undefined {
  if (style !== 'dashed') {
    return undefined
  }

  const unit = Math.max(1, Math.round(width))
  return [unit * 4, unit * 2]
}

export type PhotoBorderDrawNode =
  | { node: 'rect'; config: Record<string, unknown> }
  | { node: 'line'; config: Record<string, unknown> }

function buildDashedBorderLineNodes(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  photo: PhotoPlaceholder,
): PhotoBorderDrawNode[] {
  const radius = Math.min(Math.max(0, cornerRadius), width / 2, height / 2)
  const dash = getPhotoStrokeDash(photo.strokeStyle, photo.strokeWidth)
  const lineBase = {
    stroke: photo.stroke,
    strokeWidth: photo.strokeWidth,
    dash,
    dashEnabled: true,
    lineCap: 'butt' as const,
    listening: false,
  }

  const topY = y
  const bottomY = y + height
  const leftX = x
  const rightX = x + width

  return [
    {
      node: 'line',
      config: {
        ...lineBase,
        points: [x + radius, topY, x + width - radius, topY],
      },
    },
    {
      node: 'line',
      config: {
        ...lineBase,
        points: [rightX, y + radius, rightX, y + height - radius],
      },
    },
    {
      node: 'line',
      config: {
        ...lineBase,
        points: [x + width - radius, bottomY, x + radius, bottomY],
      },
    },
    {
      node: 'line',
      config: {
        ...lineBase,
        points: [leftX, y + height - radius, leftX, y + radius],
      },
    },
  ]
}

function buildPhotoBorderDrawNodes(
  frameWidth: number,
  frameHeight: number,
  borderRadius: number,
  photo: PhotoPlaceholder,
): PhotoBorderDrawNode[] {
  const half = photo.strokeWidth / 2
  const cornerRadius = Math.max(0, borderRadius)
  let drawX = 0
  let drawY = 0
  let drawWidth = frameWidth
  let drawHeight = frameHeight
  let drawCornerRadius = cornerRadius

  if (photo.strokePosition === 'inside') {
    drawX = half
    drawY = half
    drawWidth = frameWidth - photo.strokeWidth
    drawHeight = frameHeight - photo.strokeWidth
    drawCornerRadius = Math.max(0, cornerRadius - half)
  } else if (photo.strokePosition === 'outside') {
    drawX = -half
    drawY = -half
    drawWidth = frameWidth + photo.strokeWidth
    drawHeight = frameHeight + photo.strokeWidth
    drawCornerRadius = cornerRadius + half
  }

  drawWidth = Math.max(0, drawWidth)
  drawHeight = Math.max(0, drawHeight)

  if (photo.strokeStyle === 'dashed') {
    return buildDashedBorderLineNodes(drawX, drawY, drawWidth, drawHeight, drawCornerRadius, photo)
  }

  return [
    {
      node: 'rect',
      config: {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight,
        fill: 'transparent',
        stroke: photo.stroke,
        strokeWidth: photo.strokeWidth,
        cornerRadius: drawCornerRadius,
        listening: false,
      },
    },
  ]
}

export function getPhotoBorderDrawNodes(element: PageElement): PhotoBorderDrawNode[] {
  if (element.type !== 'photo-placeholder') {
    return []
  }

  const photo = element as PhotoPlaceholder

  // A decorative frame supersedes the plain stroke — they are not combined.
  if (photo.frame || !hasPhotoStroke(photo)) {
    return []
  }

  return buildPhotoBorderDrawNodes(
    element.size.width,
    element.size.height,
    photo.borderRadius ?? 0,
    photo,
  )
}
