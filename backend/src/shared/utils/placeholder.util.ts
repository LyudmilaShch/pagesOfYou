import { PlaceholderValueType } from '@prisma/client';
import type { CanvasElement } from '../types/canvas-data.types';

const DATE_HINT = /дата|date/i;

function getDefaultText(element: CanvasElement): string | undefined {
  if (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  ) {
    return element.defaultText?.trim() || element.label?.trim();
  }

  return undefined;
}

function getDefaultPhotoUrl(element: CanvasElement): string | undefined {
  if (element.type === 'photo-placeholder') {
    return element.defaultImageUrl?.trim() || undefined;
  }

  return undefined;
}

export function isFillableElement(element: CanvasElement): boolean {
  return (
    element.type === 'photo-placeholder' ||
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  );
}

export function isDatePlaceholder(element: CanvasElement): boolean {
  if (
    element.type !== 'text-placeholder' &&
    element.type !== 'title-placeholder' &&
    element.type !== 'subtitle-placeholder'
  ) {
    return false;
  }

  return DATE_HINT.test(element.label) || DATE_HINT.test(element.name);
}

export function resolvePlaceholderValueType(element: CanvasElement): PlaceholderValueType {
  if (element.type === 'photo-placeholder') {
    return PlaceholderValueType.PHOTO;
  }

  if (isDatePlaceholder(element)) {
    return PlaceholderValueType.DATE;
  }

  return PlaceholderValueType.TEXT;
}

export function isPlaceholderFilled(
  element: CanvasElement,
  value: { textValue?: string | null; jsonValue?: unknown } | undefined,
): boolean {
  if (!value) {
    return false;
  }

  if (element.type === 'photo-placeholder') {
    const json = value.jsonValue as { url?: string } | null | undefined;
    if (json?.url?.trim()) {
      return true;
    }

    return Boolean(getDefaultPhotoUrl(element));
  }

  if (value?.textValue?.trim()) {
    return true;
  }

  return Boolean(getDefaultText(element));
}
