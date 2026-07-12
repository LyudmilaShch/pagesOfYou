import type { PageElement } from '@/modules/editor/models'
import type { ShapeElement } from '@/modules/editor/models/shape-element.model'
import type { PhotoPlaceholder } from '@/modules/editor/models/photo-placeholder.model'
import type {
  TextAlign,
  TextPlaceholder,
  TextTransform,
  TextVerticalAlign,
} from '@/modules/editor/models/text-placeholder.model'
import {
  normalizePhotoStrokePosition,
  normalizePhotoStrokeStyle,
  normalizePhotoStrokeWidth,
} from '@/modules/editor/utils/element-stroke.util'
import type { PlaceholderJsonValue, PlaceholderValue } from '../types/order.types'

export interface LocalPlaceholderDraft {
  textValue?: string
  jsonValue?: PlaceholderJsonValue
}

function pickNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function pickPhotoStrokeFields(json: PlaceholderJsonValue, photo: PhotoPlaceholder) {
  const legacyStroke = json.strokes?.[0]

  return {
    stroke:
      typeof json.stroke === 'string'
        ? json.stroke
        : typeof legacyStroke?.color === 'string'
          ? legacyStroke.color
          : photo.stroke,
    strokeWidth:
      json.strokeWidth !== undefined
        ? normalizePhotoStrokeWidth(json.strokeWidth, photo.strokeWidth)
        : legacyStroke?.width !== undefined
          ? normalizePhotoStrokeWidth(legacyStroke.width, photo.strokeWidth)
          : photo.strokeWidth,
    strokeStyle:
      json.strokeStyle !== undefined
        ? normalizePhotoStrokeStyle(json.strokeStyle, photo.strokeStyle)
        : legacyStroke?.style !== undefined
          ? normalizePhotoStrokeStyle(legacyStroke.style, photo.strokeStyle)
          : photo.strokeStyle,
    strokePosition:
      json.strokePosition !== undefined
        ? normalizePhotoStrokePosition(json.strokePosition, photo.strokePosition)
        : legacyStroke?.position !== undefined
          ? normalizePhotoStrokePosition(legacyStroke.position, photo.strokePosition)
          : photo.strokePosition,
  }
}

export function mergeElementWithPlaceholderValue(
  template: PageElement,
  saved?: PlaceholderValue,
  local?: LocalPlaceholderDraft,
): PageElement {
  const json: PlaceholderJsonValue = {
    ...(saved?.jsonValue ?? {}),
    ...(local?.jsonValue ?? {}),
  }

  if (
    template.type === 'text-placeholder' ||
    template.type === 'title-placeholder' ||
    template.type === 'subtitle-placeholder'
  ) {
    const text = template as TextPlaceholder
    const userText =
      local?.textValue !== undefined
        ? local.textValue
        : saved?.textValue !== undefined && saved.textValue !== null
          ? saved.textValue
          : undefined

    return {
      ...text,
      defaultText: userText !== undefined ? userText : text.defaultText,
      position: json.position
        ? {
            x: pickNumber(json.position.x, text.position.x),
            y: pickNumber(json.position.y, text.position.y),
          }
        : text.position,
      size: json.size
        ? {
            width: pickNumber(json.size.width, text.size.width),
            height: pickNumber(json.size.height, text.size.height),
          }
        : text.size,
      fontFamily: typeof json.fontFamily === 'string' ? json.fontFamily : text.fontFamily,
      fontSize: pickNumber(json.fontSize, text.fontSize),
      fontWeight: pickNumber(json.fontWeight, text.fontWeight),
      fontItalic: typeof json.fontItalic === 'boolean' ? json.fontItalic : text.fontItalic,
      textTransform:
        json.textTransform === 'uppercase' || json.textTransform === 'none'
          ? (json.textTransform as TextTransform)
          : text.textTransform,
      textAlign:
        json.textAlign === 'left' ||
        json.textAlign === 'center' ||
        json.textAlign === 'right'
          ? (json.textAlign as TextAlign)
          : text.textAlign,
      letterSpacing: pickNumber(json.letterSpacing, text.letterSpacing),
      lineHeight: pickNumber(json.lineHeight, text.lineHeight),
      verticalAlign:
        json.verticalAlign === 'top' ||
        json.verticalAlign === 'middle' ||
        json.verticalAlign === 'bottom'
          ? (json.verticalAlign as TextVerticalAlign)
          : text.verticalAlign,
      color: typeof json.color === 'string' ? json.color : text.color,
      rotation: pickNumber(json.rotation, text.rotation),
    }
  }

  if (template.type === 'photo-placeholder') {
    const photo = template as PhotoPlaceholder
    const userUrl = typeof json.url === 'string' ? json.url.trim() : undefined

    return {
      ...photo,
      position: json.position
        ? {
            x: pickNumber(json.position.x, photo.position.x),
            y: pickNumber(json.position.y, photo.position.y),
          }
        : photo.position,
      size: json.size
        ? {
            width: pickNumber(json.size.width, photo.size.width),
            height: pickNumber(json.size.height, photo.size.height),
          }
        : photo.size,
      defaultImageUrl:
        userUrl !== undefined ? userUrl || null : photo.defaultImageUrl ?? null,
      cropX: pickNumber(json.cropX, photo.cropX ?? 0),
      cropY: pickNumber(json.cropY, photo.cropY ?? 0),
      imageScale: pickNumber(json.imageScale, photo.imageScale ?? 1),
      fitMode: json.fitMode === 'fill' || json.fitMode === 'cover' ? json.fitMode : photo.fitMode,
      borderRadius: pickNumber(json.borderRadius, photo.borderRadius),
      ...pickPhotoStrokeFields(json, photo),
      rotation: pickNumber(json.rotation, photo.rotation),
    }
  }

  if (
    template.type === 'shape-rectangle' ||
    template.type === 'shape-circle' ||
    template.type === 'shape-line'
  ) {
    const shape = template as ShapeElement

    return {
      ...template,
      position: json.position
        ? {
            x: pickNumber(json.position.x, template.position.x),
            y: pickNumber(json.position.y, template.position.y),
          }
        : template.position,
      size: json.size
        ? {
            width: pickNumber(json.size.width, template.size.width),
            height: pickNumber(json.size.height, template.size.height),
          }
        : template.size,
      rotation: pickNumber(json.rotation, template.rotation),
      fill: typeof json.fill === 'string' ? json.fill : shape.fill,
      stroke: typeof json.stroke === 'string' ? json.stroke : shape.stroke,
      strokeWidth: pickNumber(json.strokeWidth, shape.strokeWidth),
    }
  }

  return template
}
