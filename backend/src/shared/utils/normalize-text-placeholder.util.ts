import type { CanvasElement, CanvasTextPlaceholder } from '../types/canvas-data.types';
import { normalizePhotoPlaceholderElement } from './normalize-photo-placeholder.util';

const TEXT_TYPES = new Set([
  'text-placeholder',
  'title-placeholder',
  'subtitle-placeholder',
]);

type TextVerticalAlign = 'top' | 'middle' | 'bottom';
type TextTransform = 'none' | 'uppercase';
type TextSizingMode = 'auto' | 'fixed';

function isTextVerticalAlign(value: unknown): value is TextVerticalAlign {
  return value === 'top' || value === 'middle' || value === 'bottom';
}

function isTextTransform(value: unknown): value is TextTransform {
  return value === 'none' || value === 'uppercase';
}

function isTextSizingMode(value: unknown): value is TextSizingMode {
  return value === 'auto' || value === 'fixed';
}

function isCanvasTextPlaceholder(element: CanvasElement): element is CanvasTextPlaceholder {
  return TEXT_TYPES.has(element.type);
}

export function normalizeTextPlaceholderElement(element: CanvasElement): CanvasElement {
  if (!isCanvasTextPlaceholder(element)) {
    return element;
  }

  const text = element as CanvasTextPlaceholder & {
    lineHeight?: number;
    letterSpacing?: number;
    fontWeight?: number;
    fontItalic?: boolean;
    verticalAlign?: TextVerticalAlign;
    textTransform?: TextTransform;
    textSizingMode?: TextSizingMode;
  };

  return {
    ...text,
    rotation: 0,
    lineHeight:
      typeof text.lineHeight === 'number' && text.lineHeight > 0 ? text.lineHeight : 1.4,
    letterSpacing: typeof text.letterSpacing === 'number' ? text.letterSpacing : 0,
    fontWeight: typeof text.fontWeight === 'number' ? text.fontWeight : 400,
    fontItalic: Boolean(text.fontItalic),
    verticalAlign: isTextVerticalAlign(text.verticalAlign) ? text.verticalAlign : 'top',
    textTransform: isTextTransform(text.textTransform) ? text.textTransform : 'none',
    textSizingMode: isTextSizingMode(text.textSizingMode) ? text.textSizingMode : 'auto',
  };
}

export function normalizeCanvasElement(element: CanvasElement): CanvasElement {
  return normalizePhotoPlaceholderElement(normalizeTextPlaceholderElement(element));
}

export function normalizeCanvasElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map(normalizeCanvasElement);
}
