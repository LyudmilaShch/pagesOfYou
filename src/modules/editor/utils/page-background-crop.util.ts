import {
  TRANSFORMER_ANCHOR_STROKE,
  TRANSFORMER_ANCHOR_STROKE_WIDTH,
  TRANSFORMER_BORDER_STROKE,
  TRANSFORMER_BORDER_STROKE_WIDTH,
  TRANSFORMER_CORNER_ANCHOR_SIZE,
} from '../constants/page.constants'
import type { PageBackgroundImageFit } from '../models/page-background.model'
import type { PhotoImageLayout, PhotoScaleCorner } from './photo-crop.util'
import { getPhotoLayoutCornerPosition } from './photo-crop.util'

export function getPageBackgroundCropPageFrameConfig(
  frameWidth: number,
  frameHeight: number,
): Record<string, unknown> {
  return {
    x: 0,
    y: 0,
    width: frameWidth,
    height: frameHeight,
    stroke: TRANSFORMER_BORDER_STROKE,
    strokeWidth: TRANSFORMER_BORDER_STROKE_WIDTH,
    listening: false,
  }
}

export function getPageBackgroundCropImageBoundsConfig(
  layout: PhotoImageLayout,
): Record<string, unknown> {
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    stroke: TRANSFORMER_BORDER_STROKE,
    strokeWidth: TRANSFORMER_BORDER_STROKE_WIDTH,
    listening: false,
  }
}

export function getPageBackgroundCropPanHitConfig(
  layout: PhotoImageLayout,
): Record<string, unknown> {
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    fill: 'rgba(0, 0, 0, 0.001)',
    listening: true,
    draggable: false,
    name: 'page-background-crop-pan',
  }
}

export function getPageBackgroundCropScaleHandleConfigs(layout: PhotoImageLayout): Array<{
  corner: PhotoScaleCorner
  config: Record<string, unknown>
}> {
  const corners: PhotoScaleCorner[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]

  return corners.map((corner) => ({
    corner,
    config: {
      ...getPhotoLayoutCornerPosition(layout, corner),
      radius: TRANSFORMER_CORNER_ANCHOR_SIZE / 2,
      fill: '#FFFFFF',
      stroke: TRANSFORMER_ANCHOR_STROKE,
      strokeWidth: TRANSFORMER_ANCHOR_STROKE_WIDTH,
      hitStrokeWidth: 14,
      name: 'page-background-crop-scale',
      listening: true,
      draggable: false,
      perfectDrawEnabled: false,
    },
  }))
}

export function resolvePageBackgroundCropFitMode(
  fitMode: PageBackgroundImageFit,
): PageBackgroundImageFit {
  return fitMode === 'fill' ? 'fill' : 'cover'
}
