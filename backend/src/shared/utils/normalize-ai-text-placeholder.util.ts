import type {
  CanvasAiTextPlaceholder,
  CanvasElement,
  CanvasLengthConstraint,
  CanvasLengthConstraintUnit,
  CanvasTextEffect,
  CanvasTextEffectType,
} from '../types/canvas-data.types';

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

function isLengthConstraintUnit(value: unknown): value is CanvasLengthConstraintUnit {
  return value === 'characters' || value === 'words';
}

function normalizeLengthBound(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeLengthConstraint(value: unknown): CanvasLengthConstraint {
  const candidate = (value && typeof value === 'object' ? value : {}) as Partial<CanvasLengthConstraint>;
  return {
    unit: isLengthConstraintUnit(candidate.unit) ? candidate.unit : 'characters',
    min: normalizeLengthBound(candidate.min),
    max: normalizeLengthBound(candidate.max),
  };
}

export function normalizeAiTextPlaceholderElement(element: CanvasElement): CanvasElement {
  if (element.type !== 'ai-text-placeholder') {
    return element;
  }

  const aiText = element as CanvasAiTextPlaceholder & {
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
    ...aiText,
    label: typeof aiText.label === 'string' && aiText.label.trim() ? aiText.label : 'AI-текст',
    prompt: typeof aiText.prompt === 'string' ? aiText.prompt : '',
    questionKeys: Array.isArray(aiText.questionKeys)
      ? aiText.questionKeys.filter((key): key is string => typeof key === 'string')
      : [],
    lengthConstraint: normalizeLengthConstraint(aiText.lengthConstraint),
    rotation: typeof aiText.rotation === 'number' && Number.isFinite(aiText.rotation) ? aiText.rotation : 0,
    lineHeight: typeof aiText.lineHeight === 'number' && aiText.lineHeight > 0 ? aiText.lineHeight : 1.4,
    letterSpacing: typeof aiText.letterSpacing === 'number' ? aiText.letterSpacing : 0,
    fontWeight: typeof aiText.fontWeight === 'number' ? aiText.fontWeight : 400,
    fontItalic: Boolean(aiText.fontItalic),
    verticalAlign: isTextVerticalAlign(aiText.verticalAlign) ? aiText.verticalAlign : 'top',
    textTransform: isTextTransform(aiText.textTransform) ? aiText.textTransform : 'none',
    textSizingMode: isTextSizingMode(aiText.textSizingMode) ? aiText.textSizingMode : 'auto',
    effect: isTextEffect(aiText.effect) ? aiText.effect : null,
  };
}
