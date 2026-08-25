import type {
  CanvasElement,
  CanvasTextPlaceholder,
  CanvasTextEffect,
  CanvasTextEffectType,
} from '../types/canvas-data.types';
import { normalizePhotoPlaceholderElement } from './normalize-photo-placeholder.util';

const TEXT_TYPES = new Set([
  'text-placeholder',
  'title-placeholder',
  'subtitle-placeholder',
]);

type TextVerticalAlign = 'top' | 'middle' | 'bottom';
type TextTransform = 'none' | 'uppercase';
type TextSizingMode = 'auto' | 'fixed';

const TEXT_EFFECT_TYPES = new Set<CanvasTextEffectType>([
  'drop-shadow',
  'glow',
  'echo',
  'outlined',
  'background',
  'stroke',
  'neon',
]);

function isTextVerticalAlign(value: unknown): value is TextVerticalAlign {
  return value === 'top' || value === 'middle' || value === 'bottom';
}

function isTextTransform(value: unknown): value is TextTransform {
  return value === 'none' || value === 'uppercase';
}

function isTextSizingMode(value: unknown): value is TextSizingMode {
  return value === 'auto' || value === 'fixed';
}

function isTextEffect(value: unknown): value is CanvasTextEffect | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'object') {
    return false;
  }
  const candidate = value as { type?: unknown; params?: unknown };
  return (
    typeof candidate.type === 'string' &&
    TEXT_EFFECT_TYPES.has(candidate.type as CanvasTextEffectType) &&
    typeof candidate.params === 'object' &&
    candidate.params !== null
  );
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
    effect?: unknown;
  };

  return {
    ...text,
    rotation: typeof text.rotation === 'number' && Number.isFinite(text.rotation) ? text.rotation : 0,
    lineHeight:
      typeof text.lineHeight === 'number' && text.lineHeight > 0 ? text.lineHeight : 1.4,
    letterSpacing: typeof text.letterSpacing === 'number' ? text.letterSpacing : 0,
    fontWeight: typeof text.fontWeight === 'number' ? text.fontWeight : 400,
    fontItalic: Boolean(text.fontItalic),
    verticalAlign: isTextVerticalAlign(text.verticalAlign) ? text.verticalAlign : 'top',
    textTransform: isTextTransform(text.textTransform) ? text.textTransform : 'none',
    textSizingMode: isTextSizingMode(text.textSizingMode) ? text.textSizingMode : 'auto',
    effect: isTextEffect(text.effect) ? text.effect : null,
  };
}

export function normalizeCanvasElement(element: CanvasElement): CanvasElement {
  return normalizePhotoPlaceholderElement(normalizeTextPlaceholderElement(element));
}

export function normalizeCanvasElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map(normalizeCanvasElement);
}
