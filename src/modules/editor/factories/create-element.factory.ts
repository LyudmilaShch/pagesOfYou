import {
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
  EDITOR_FONT_BODY,
  EDITOR_FONT_DISPLAY,
} from '../constants/page.constants'
import { TEXT_FONT_SIZE_DEFAULT, TEXT_SIZING_MODE_DEFAULT } from '../constants/text.constants'
import type { PageElement, PageElementBase, PageElementType } from '../models'

export type LibraryElementType =
  | 'photo-placeholder'
  | 'title-placeholder'
  | 'subtitle-placeholder'
  | 'text-placeholder'
  | 'shape-line'
  | 'shape-rectangle'
  | 'shape-circle'

export type LibraryElementCategory = 'photo' | 'text' | 'shape'

export interface LibraryElementDefinition {
  type: LibraryElementType
  label: string
  icon: string
  description: string
  category: LibraryElementCategory
}

export const LIBRARY_ELEMENTS: LibraryElementDefinition[] = [
  {
    type: 'photo-placeholder',
    label: 'Фото',
    icon: 'mdi-image-outline',
    description: 'Область для фотографии',
    category: 'photo',
  },
  {
    type: 'title-placeholder',
    label: 'Заголовок',
    icon: 'mdi-format-title',
    description: 'Крупный заголовок',
    category: 'text',
  },
  {
    type: 'subtitle-placeholder',
    label: 'Подзаголовок',
    icon: 'mdi-format-header-2',
    description: 'Вторичный заголовок',
    category: 'text',
  },
  {
    type: 'text-placeholder',
    label: 'Текст',
    icon: 'mdi-format-text',
    description: 'Текстовый блок',
    category: 'text',
  },
  {
    type: 'shape-line',
    label: 'Линия',
    icon: 'mdi-minus',
    description: 'Декоративная линия',
    category: 'shape',
  },
  {
    type: 'shape-rectangle',
    label: 'Прямоугольник',
    icon: 'mdi-rectangle-outline',
    description: 'Прямоугольная форма',
    category: 'shape',
  },
  {
    type: 'shape-circle',
    label: 'Круг',
    icon: 'mdi-circle-outline',
    description: 'Круглая форма',
    category: 'shape',
  },
]

let elementCounter = 0

function nextElementId(type: PageElementType): string {
  elementCounter += 1
  return `${type}-${Date.now()}-${elementCounter}`
}

function baseElement<T extends PageElementType>(
  type: T,
  name: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  zIndex: number,
): PageElementBase & { type: T } {
  return {
    id: nextElementId(type),
    type,
    name,
    position,
    size,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    opacity: 1,
  }
}

export function createElementFromLibrary(
  type: LibraryElementType,
  zIndex: number,
  pageWidth: number,
  pageHeight: number,
): PageElement {
  const centerX = pageWidth / 2
  const centerY = pageHeight / 2

  switch (type) {
    case 'photo-placeholder':
      return {
        ...baseElement(type, 'Фото', { x: centerX - 100, y: centerY - 130 }, { width: 200, height: 260 }, zIndex),
        label: 'Фото',
        borderRadius: 0,
        fitMode: 'cover',
        maxImages: 1,
        required: true,
        defaultImageUrl: null,
        stroke: '#111111',
        strokeWidth: 0,
        strokeStyle: 'solid',
        strokePosition: 'center',
        cropX: 0,
        cropY: 0,
        imageScale: 1,
      }

    case 'title-placeholder':
      return {
        ...baseElement(type, 'Заголовок', { x: centerX - 180, y: 120 }, { width: 80, height: 48 }, zIndex),
        label: 'Заголовок',
        defaultText: 'Заголовок',
        fontFamily: EDITOR_FONT_DISPLAY,
        fontSize: 36,
        fontWeight: 400,
        fontItalic: false,
        lineHeight: 1.15,
        letterSpacing: 0,
        textAlign: 'left',
        verticalAlign: 'top',
        textTransform: 'none',
        textSizingMode: TEXT_SIZING_MODE_DEFAULT,
        color: '#111111',
        maxLength: 120,
        required: false,
      }

    case 'subtitle-placeholder':
      return {
        ...baseElement(type, 'Подзаголовок', { x: centerX - 160, y: 200 }, { width: 80, height: 36 }, zIndex),
        label: 'Подзаголовок',
        defaultText: 'Подзаголовок',
        fontFamily: EDITOR_FONT_DISPLAY,
        fontSize: 24,
        fontWeight: 400,
        fontItalic: false,
        lineHeight: 1.25,
        letterSpacing: 0,
        textAlign: 'left',
        verticalAlign: 'top',
        textTransform: 'none',
        textSizingMode: TEXT_SIZING_MODE_DEFAULT,
        color: '#111111',
        maxLength: 160,
        required: false,
      }

    case 'text-placeholder':
      return {
        ...baseElement(type, 'Текст', { x: centerX - 150, y: centerY }, { width: 80, height: 28 }, zIndex),
        label: 'Текстовый блок',
        defaultText: 'Текстовый блок',
        fontFamily: EDITOR_FONT_BODY,
        fontSize: TEXT_FONT_SIZE_DEFAULT,
        fontWeight: 400,
        fontItalic: false,
        lineHeight: 1.5,
        letterSpacing: 0,
        textAlign: 'left',
        verticalAlign: 'top',
        textTransform: 'none',
        textSizingMode: TEXT_SIZING_MODE_DEFAULT,
        color: '#111111',
        maxLength: 500,
        required: false,
      }

    case 'shape-rectangle':
      return {
        ...baseElement(type, 'Прямоугольник', { x: centerX - 80, y: centerY - 50 }, { width: 160, height: 100 }, zIndex),
        fill: DEFAULT_SHAPE_FILL,
        stroke: DEFAULT_SHAPE_STROKE,
        strokeWidth: 0,
      }

    case 'shape-circle':
      return {
        ...baseElement(type, 'Круг', { x: centerX - 60, y: centerY - 60 }, { width: 120, height: 120 }, zIndex),
        fill: DEFAULT_SHAPE_FILL,
        stroke: DEFAULT_SHAPE_STROKE,
        strokeWidth: 0,
      }

    case 'shape-line':
      return {
        ...baseElement(type, 'Линия', { x: centerX - 120, y: centerY }, { width: 240, height: 0 }, zIndex),
        fill: 'transparent',
        stroke: DEFAULT_SHAPE_STROKE,
        strokeWidth: 2,
      }
  }
}
