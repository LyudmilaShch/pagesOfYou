/**
 * Canonical canvas JSON schema for MagazinePage.canvasData.
 * Independent from Konva — used for storage, PDF generation and user filling.
 */

import { normalizeCanvasElements } from '../utils/normalize-text-placeholder.util';
import { migrateLegacyBackgroundElements } from '../utils/migrate-legacy-background.util';

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export type CanvasElementType =
  | 'photo-placeholder'
  | 'text-placeholder'
  | 'title-placeholder'
  | 'subtitle-placeholder'
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-line';

export interface CanvasElementBase {
  id: string;
  type: CanvasElementType;
  name: string;
  position: CanvasPosition;
  size: CanvasSize;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

/** Decorative 9-slice frame, copied from the PhotoFrame catalog when selected. */
export interface CanvasPhotoFrame {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  sliceTop: number;
  sliceRight: number;
  sliceBottom: number;
  sliceLeft: number;
  /** Photo window insets (source PNG px) — where the photo may be positioned within the frame. */
  photoAreaTop: number;
  photoAreaRight: number;
  photoAreaBottom: number;
  photoAreaLeft: number;
}

export interface CanvasPhotoPlaceholder extends CanvasElementBase {
  type: 'photo-placeholder';
  label: string;
  borderRadius: number;
  fitMode: 'cover' | 'contain' | 'fill';
  maxImages: number;
  required: boolean;
  /** Admin default image — shown until user uploads their own */
  defaultImageUrl?: string | null;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed';
  strokePosition?: 'center' | 'inside' | 'outside';
  cropX?: number;
  cropY?: number;
  imageScale?: number;
  frame?: CanvasPhotoFrame | null;
}

export interface CanvasTextPlaceholder extends CanvasElementBase {
  type: 'text-placeholder' | 'title-placeholder' | 'subtitle-placeholder';
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontItalic: boolean;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  textTransform: 'none' | 'uppercase';
  textSizingMode: 'auto' | 'fixed';
  color: string;
  maxLength: number;
  required: boolean;
  /** Admin default text — shown until user replaces it */
  defaultText?: string;
}

export interface CanvasShapeElement extends CanvasElementBase {
  type: 'shape-rectangle' | 'shape-circle' | 'shape-line';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type CanvasElement =
  | CanvasPhotoPlaceholder
  | CanvasTextPlaceholder
  | CanvasShapeElement;

export interface PageBackgroundSettings {
  backgroundColor?: string;
  backgroundImageUrl?: string | null;
  backgroundImageFit?: 'cover' | 'fill';
  backgroundImageCropX?: number;
  backgroundImageCropY?: number;
  backgroundImageScale?: number;
}

export interface CanvasData {
  version: 1;
  pageWidth?: number;
  pageHeight?: number;
  backgroundColor?: string;
  backgroundImageUrl?: string | null;
  backgroundImageFit?: 'cover' | 'fill';
  backgroundImageCropX?: number;
  backgroundImageCropY?: number;
  backgroundImageScale?: number;
  spreadBackgroundMode?: 'spread' | 'per-page';
  leftPageBackground?: PageBackgroundSettings;
  rightPageBackground?: PageBackgroundSettings;
  elements: CanvasElement[];
}

export const CANVAS_DATA_VERSION = 1 as const;

export const A4_PAGE_WIDTH = 595;
export const A4_PAGE_HEIGHT = 842;
export const A4_SPREAD_PAGE_WIDTH = A4_PAGE_WIDTH * 2;
export const A4_SPREAD_PAGE_HEIGHT = A4_PAGE_HEIGHT;

function normalizePageBackgroundImageFit(
  value: unknown,
): 'cover' | 'fill' {
  if (value === 'fill') {
    return 'fill';
  }

  return 'cover';
}

function normalizeSpreadBackgroundMode(value: unknown): 'spread' | 'per-page' {
  if (value === 'per-page') {
    return 'per-page';
  }

  return 'spread';
}

function normalizePageBackgroundSettings(
  partial: PageBackgroundSettings | null | undefined,
  fallback: PageBackgroundSettings,
): PageBackgroundSettings {
  const source = partial ?? {};
  const crop = normalizePageBackgroundCrop({
    backgroundImageCropX: source.backgroundImageCropX ?? fallback.backgroundImageCropX,
    backgroundImageCropY: source.backgroundImageCropY ?? fallback.backgroundImageCropY,
    backgroundImageScale: source.backgroundImageScale ?? fallback.backgroundImageScale,
  });

  return {
    backgroundColor:
      typeof source.backgroundColor === 'string'
        ? source.backgroundColor
        : fallback.backgroundColor,
    backgroundImageUrl:
      typeof source.backgroundImageUrl === 'string'
        ? source.backgroundImageUrl
        : source.backgroundImageUrl === null
          ? null
          : fallback.backgroundImageUrl,
    backgroundImageFit: normalizePageBackgroundImageFit(
      source.backgroundImageFit ?? fallback.backgroundImageFit,
    ),
    backgroundImageCropX: crop.cropX,
    backgroundImageCropY: crop.cropY,
    backgroundImageScale: crop.imageScale,
  };
}

function isSpreadCanvas(pageWidth: number, pageHeight: number): boolean {
  return pageWidth === A4_SPREAD_PAGE_WIDTH && pageHeight === A4_SPREAD_PAGE_HEIGHT;
}

function normalizePageBackgroundCrop(data: Partial<CanvasData>): {
  cropX: number;
  cropY: number;
  imageScale: number;
} {
  return {
    cropX: typeof data.backgroundImageCropX === 'number' ? data.backgroundImageCropX : 0,
    cropY: typeof data.backgroundImageCropY === 'number' ? data.backgroundImageCropY : 0,
    imageScale:
      typeof data.backgroundImageScale === 'number' && data.backgroundImageScale > 0
        ? data.backgroundImageScale
        : 1,
  };
}

export function createDefaultCanvasData(): CanvasData {
  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_PAGE_WIDTH,
    pageHeight: A4_PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    elements: [],
  };
}

export function createSpreadCanvasData(): CanvasData {
  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    spreadBackgroundMode: 'spread',
    elements: [],
  };
}

export function createCanvasDataForPageType(pageType: string): CanvasData {
  if (pageType === 'SPREAD') {
    return createSpreadCanvasData();
  }

  return createDefaultCanvasData();
}

export function normalizeCanvasData(raw: unknown): CanvasData {
  if (!raw || typeof raw !== 'object') {
    return createDefaultCanvasData();
  }

  const data = raw as Partial<CanvasData>;
  const rawElements = Array.isArray(data.elements) ? (data.elements as CanvasElement[]) : [];
  const migrated = migrateLegacyBackgroundElements(rawElements, data.backgroundColor);
  const backgroundCrop = normalizePageBackgroundCrop(data);
  const pageWidth = typeof data.pageWidth === 'number' ? data.pageWidth : 595;
  const pageHeight = typeof data.pageHeight === 'number' ? data.pageHeight : 842;
  const spread = isSpreadCanvas(pageWidth, pageHeight);
  const rootBackground: PageBackgroundSettings = {
    backgroundColor:
      typeof migrated.backgroundColor === 'string' ? migrated.backgroundColor : '#FFFFFF',
    backgroundImageUrl:
      typeof data.backgroundImageUrl === 'string'
        ? data.backgroundImageUrl
        : data.backgroundImageUrl === null
          ? null
          : undefined,
    backgroundImageFit: normalizePageBackgroundImageFit(data.backgroundImageFit),
    backgroundImageCropX: backgroundCrop.cropX,
    backgroundImageCropY: backgroundCrop.cropY,
    backgroundImageScale: backgroundCrop.imageScale,
  };

  const normalized: CanvasData = {
    version: 1,
    pageWidth,
    pageHeight,
    backgroundColor: rootBackground.backgroundColor,
    backgroundImageUrl: rootBackground.backgroundImageUrl,
    backgroundImageFit: rootBackground.backgroundImageFit,
    backgroundImageCropX: rootBackground.backgroundImageCropX,
    backgroundImageCropY: rootBackground.backgroundImageCropY,
    backgroundImageScale: rootBackground.backgroundImageScale,
    elements: normalizeCanvasElements(migrated.elements),
  };

  if (spread) {
    const spreadBackgroundMode = normalizeSpreadBackgroundMode(data.spreadBackgroundMode);
    normalized.spreadBackgroundMode = spreadBackgroundMode;

    if (spreadBackgroundMode === 'per-page') {
      normalized.leftPageBackground = normalizePageBackgroundSettings(
        data.leftPageBackground,
        rootBackground,
      );
      normalized.rightPageBackground = normalizePageBackgroundSettings(
        data.rightPageBackground,
        rootBackground,
      );
    }
  }

  return normalized;
}
