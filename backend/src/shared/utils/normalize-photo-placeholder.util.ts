import type {
  CanvasElement,
  CanvasPhotoCorrectionParams,
  CanvasPhotoFilter,
  CanvasPhotoFilterPresetKey,
  CanvasPhotoFrame,
  CanvasPhotoMask,
  CanvasPhotoMaskType,
  CanvasPhotoPlaceholder,
} from '../types/canvas-data.types';
import { toStoredAssetPath } from '../../common/utils/asset-url.util';

const PHOTO_MASK_GEOMETRIC_TYPES = new Set<CanvasPhotoMaskType>([
  'circle',
  'oval',
  'rectangle',
  'rounded-rectangle',
  'heart',
  'star',
  'diamond',
]);

function isCanvasPhotoMaskPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
}

function normalizePhotoMask(value: unknown): CanvasPhotoMask | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { type?: unknown; name?: unknown; points?: unknown };

  if (candidate.type === 'custom') {
    if (!Array.isArray(candidate.points) || !candidate.points.every(isCanvasPhotoMaskPoint)) {
      return null;
    }
    return {
      type: 'custom',
      name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'Своя маска',
      points: candidate.points as Array<{ x: number; y: number }>,
    };
  }

  return typeof candidate.type === 'string' &&
    PHOTO_MASK_GEOMETRIC_TYPES.has(candidate.type as CanvasPhotoMaskType)
    ? { type: candidate.type as Exclude<CanvasPhotoMaskType, 'custom'> }
    : null;
}

const PHOTO_FILTER_PRESET_KEYS = new Set<CanvasPhotoFilterPresetKey>([
  'editorial',
  'classic',
  'soft',
  'warm',
  'vintage',
  'film',
  'bw',
  'pastel',
  'love',
]);

const PHOTO_CORRECTION_NEUTRAL: CanvasPhotoCorrectionParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  hue: 0,
  blur: 0,
};

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePhotoCorrection(value: unknown): CanvasPhotoCorrectionParams {
  const candidate = (value && typeof value === 'object' ? value : {}) as Partial<CanvasPhotoCorrectionParams>;
  return {
    brightness: isFiniteNumber(candidate.brightness) ? candidate.brightness : PHOTO_CORRECTION_NEUTRAL.brightness,
    contrast: isFiniteNumber(candidate.contrast) ? candidate.contrast : PHOTO_CORRECTION_NEUTRAL.contrast,
    saturation: isFiniteNumber(candidate.saturation) ? candidate.saturation : PHOTO_CORRECTION_NEUTRAL.saturation,
    temperature: isFiniteNumber(candidate.temperature) ? candidate.temperature : PHOTO_CORRECTION_NEUTRAL.temperature,
    hue: isFiniteNumber(candidate.hue) ? candidate.hue : PHOTO_CORRECTION_NEUTRAL.hue,
    blur: isFiniteNumber(candidate.blur) ? candidate.blur : PHOTO_CORRECTION_NEUTRAL.blur,
  };
}

function normalizePhotoFilter(value: unknown): CanvasPhotoFilter | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CanvasPhotoFilter>;
  const preset =
    typeof candidate.preset === 'string' &&
    PHOTO_FILTER_PRESET_KEYS.has(candidate.preset as CanvasPhotoFilterPresetKey)
      ? (candidate.preset as CanvasPhotoFilterPresetKey)
      : null;

  return {
    preset,
    intensity: isFiniteNumber(candidate.intensity) ? Math.min(100, Math.max(0, candidate.intensity)) : 100,
    correction: normalizePhotoCorrection(candidate.correction),
  };
}

function normalizePhotoFrame(value: unknown): CanvasPhotoFrame | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const frame = value as Partial<CanvasPhotoFrame>;

  if (
    typeof frame.imageUrl !== 'string' ||
    !frame.imageUrl.trim() ||
    !isFiniteNumber(frame.naturalWidth) ||
    !isFiniteNumber(frame.naturalHeight) ||
    !isFiniteNumber(frame.sliceTop) ||
    !isFiniteNumber(frame.sliceRight) ||
    !isFiniteNumber(frame.sliceBottom) ||
    !isFiniteNumber(frame.sliceLeft)
  ) {
    return null;
  }

  return {
    imageUrl: toStoredAssetPath(frame.imageUrl) ?? frame.imageUrl.trim(),
    naturalWidth: frame.naturalWidth,
    naturalHeight: frame.naturalHeight,
    sliceTop: frame.sliceTop,
    sliceRight: frame.sliceRight,
    sliceBottom: frame.sliceBottom,
    sliceLeft: frame.sliceLeft,
    // Older elements were saved before the photo-area feature — default to 0 (full box), not reject the frame.
    photoAreaTop: isFiniteNumber(frame.photoAreaTop) ? frame.photoAreaTop : 0,
    photoAreaRight: isFiniteNumber(frame.photoAreaRight) ? frame.photoAreaRight : 0,
    photoAreaBottom: isFiniteNumber(frame.photoAreaBottom) ? frame.photoAreaBottom : 0,
    photoAreaLeft: isFiniteNumber(frame.photoAreaLeft) ? frame.photoAreaLeft : 0,
  };
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
    imageRotation:
      typeof photo.imageRotation === 'number' && Number.isFinite(photo.imageRotation)
        ? photo.imageRotation
        : 0,
    frame: normalizePhotoFrame(photo.frame),
    filter: normalizePhotoFilter(photo.filter),
    mask: normalizePhotoMask(photo.mask),
  };
}
