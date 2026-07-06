/**
 * Canonical canvas JSON schema for MagazinePage.canvasData.
 * Independent from Konva — used for storage, PDF generation and user filling.
 */

import { normalizeCanvasElements } from '../utils/normalize-text-placeholder.util';

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
  | 'shape-line'
  | 'background';

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

export interface CanvasBackgroundElement extends CanvasElementBase {
  type: 'background';
  color: string;
}

export type CanvasElement =
  | CanvasPhotoPlaceholder
  | CanvasTextPlaceholder
  | CanvasShapeElement
  | CanvasBackgroundElement;

export interface CanvasData {
  version: 1;
  pageWidth?: number;
  pageHeight?: number;
  backgroundColor?: string;
  elements: CanvasElement[];
}

export const CANVAS_DATA_VERSION = 1 as const;

export const A4_PAGE_WIDTH = 595;
export const A4_PAGE_HEIGHT = 842;
export const A4_SPREAD_PAGE_WIDTH = A4_PAGE_WIDTH * 2;
export const A4_SPREAD_PAGE_HEIGHT = A4_PAGE_HEIGHT;

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

  return {
    version: 1,
    pageWidth: typeof data.pageWidth === 'number' ? data.pageWidth : 595,
    pageHeight: typeof data.pageHeight === 'number' ? data.pageHeight : 842,
    backgroundColor:
      typeof data.backgroundColor === 'string' ? data.backgroundColor : '#FFFFFF',
    elements: Array.isArray(data.elements)
      ? normalizeCanvasElements(data.elements as CanvasElement[])
      : [],
  };
}
