import type { CanvasElement, CanvasPhotoPlaceholder } from '../types/canvas-data.types';
import { toStoredAssetPath } from '../../common/utils/asset-url.util';

const STROKE_LINE_STYLES = new Set(['solid', 'dashed']);
const STROKE_POSITIONS = new Set(['center', 'inside', 'outside']);

type LegacyCanvasPhotoPlaceholder = CanvasPhotoPlaceholder & {
  strokes?: Array<{
    color?: string;
    width?: number;
    style?: 'solid' | 'dashed';
    position?: 'center' | 'inside' | 'outside';
  }>;
  url?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  src?: string | null;
};

function normalizePhotoStrokeStyle(value: unknown): 'solid' | 'dashed' {
  return typeof value === 'string' && STROKE_LINE_STYLES.has(value)
    ? (value as 'solid' | 'dashed')
    : 'solid';
}

function normalizePhotoStrokePosition(value: unknown): 'center' | 'inside' | 'outside' {
  return typeof value === 'string' && STROKE_POSITIONS.has(value)
    ? (value as 'center' | 'inside' | 'outside')
    : 'center';
}

function normalizePhotoStrokeWidth(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function resolveStoredDefaultImageUrl(photo: LegacyCanvasPhotoPlaceholder): string | null {
  const candidates = [
    photo.defaultImageUrl,
    photo.url,
    photo.imageUrl,
    photo.image,
    photo.src,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return toStoredAssetPath(value) ?? value.trim();
    }
  }

  return null;
}

function resolveInitialPhotoStroke(photo: LegacyCanvasPhotoPlaceholder) {
  const legacyStroke = Array.isArray(photo.strokes) ? photo.strokes[0] : undefined;

  if (legacyStroke) {
    return {
      stroke:
        typeof legacyStroke.color === 'string' && legacyStroke.color.trim()
          ? legacyStroke.color
          : '#111111',
      strokeWidth: normalizePhotoStrokeWidth(legacyStroke.width, 0),
      strokeStyle: normalizePhotoStrokeStyle(legacyStroke.style),
      strokePosition: normalizePhotoStrokePosition(legacyStroke.position),
    };
  }

  return {
    stroke: typeof photo.stroke === 'string' && photo.stroke.trim() ? photo.stroke : '#111111',
    strokeWidth: normalizePhotoStrokeWidth(photo.strokeWidth, 0),
    strokeStyle: normalizePhotoStrokeStyle(photo.strokeStyle),
    strokePosition: normalizePhotoStrokePosition(photo.strokePosition),
  };
}

export function normalizePhotoPlaceholderElement(element: CanvasElement): CanvasElement {
  if (element.type !== 'photo-placeholder') {
    return element;
  }

  const photo = element as LegacyCanvasPhotoPlaceholder;
  const stroke = resolveInitialPhotoStroke(photo);

  return {
    ...photo,
    defaultImageUrl: resolveStoredDefaultImageUrl(photo),
    ...stroke,
    cropX: typeof photo.cropX === 'number' ? photo.cropX : 0,
    cropY: typeof photo.cropY === 'number' ? photo.cropY : 0,
    imageScale:
      typeof photo.imageScale === 'number' && photo.imageScale > 0 ? photo.imageScale : 1,
  };
}
