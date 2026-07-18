import type { PageElement } from '@/modules/editor/models'
import type { PlaceholderValueType } from '../types/order.types'

const DATE_HINT = /дата|date/i

export function isFillableElement(element: PageElement): boolean {
  return (
    element.type === 'photo-placeholder' ||
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  )
}

export function isDatePlaceholder(element: PageElement): boolean {
  if (
    element.type !== 'text-placeholder' &&
    element.type !== 'title-placeholder' &&
    element.type !== 'subtitle-placeholder'
  ) {
    return false
  }

  return DATE_HINT.test(element.label) || DATE_HINT.test(element.name)
}

export function resolvePlaceholderValueType(element: PageElement): PlaceholderValueType {
  if (element.type === 'photo-placeholder') {
    return 'PHOTO'
  }

  if (isDatePlaceholder(element)) {
    return 'DATE'
  }

  return 'TEXT'
}

export function getPlaceholderLabel(element: PageElement): string {
  if (element.type === 'photo-placeholder') {
    return element.label || element.name || 'Фото'
  }

  if (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  ) {
    return element.label || element.name
  }

  return element.name
}

export function isPlaceholderFilled(
  element: PageElement,
  value: { textValue?: string | null; jsonValue?: { url?: string } | null } | undefined,
): boolean {
  if (element.type === 'photo-placeholder') {
    if (value?.jsonValue?.url?.trim()) {
      return true
    }

    return Boolean(element.defaultImageUrl?.trim())
  }

  if (value?.textValue?.trim()) {
    return true
  }

  if (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  ) {
    return Boolean(element.defaultText?.trim() || element.label?.trim())
  }

  return false
}
