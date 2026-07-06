import type { PageElement } from '../models'
import type { PhotoPlaceholder } from '../models/photo-placeholder.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'

export function getPlaceholderDisplayText(
  element: PageElement,
  userText?: string | null,
): string | null {
  if (userText?.trim()) {
    return userText.trim()
  }

  if (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  ) {
    const textEl = element as TextPlaceholder
    return textEl.defaultText?.trim() || textEl.label?.trim() || null
  }

  return null
}

export function getPlaceholderPhotoUrl(
  element: PageElement,
  userUrl?: string | null,
): string | null {
  if (userUrl?.trim()) {
    return userUrl.trim()
  }

  if (element.type === 'photo-placeholder') {
    return (element as PhotoPlaceholder).defaultImageUrl?.trim() || null
  }

  return null
}

export function isTextPlaceholderElement(
  element: PageElement,
): element is TextPlaceholder {
  return (
    element.type === 'text-placeholder' ||
    element.type === 'title-placeholder' ||
    element.type === 'subtitle-placeholder'
  )
}

export function isPhotoPlaceholderElement(
  element: PageElement,
): element is PhotoPlaceholder {
  return element.type === 'photo-placeholder'
}
