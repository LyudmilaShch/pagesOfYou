import type { PageElementType } from '../models'

export interface ElementTypeMeta {
  label: string
  icon: string
}

export const ELEMENT_TYPE_META: Record<PageElementType, ElementTypeMeta> = {
  'photo-placeholder': { label: 'Фото', icon: 'mdi-image-outline' },
  'title-placeholder': { label: 'Заголовок', icon: 'mdi-format-title' },
  'subtitle-placeholder': { label: 'Подзаголовок', icon: 'mdi-format-header-2' },
  'text-placeholder': { label: 'Текст', icon: 'mdi-format-text' },
  'shape-line': { label: 'Линия', icon: 'mdi-minus' },
  'shape-rectangle': { label: 'Прямоугольник', icon: 'mdi-rectangle-outline' },
  'shape-circle': { label: 'Круг', icon: 'mdi-circle-outline' },
}

export function getElementMeta(type: PageElementType): ElementTypeMeta {
  return ELEMENT_TYPE_META[type]
}
