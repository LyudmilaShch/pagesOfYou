import type { PageElementBase } from './page-element.model'
import type { TextEffect } from './text-effect.model'

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type TextVerticalAlign = 'top' | 'middle' | 'bottom'

export type TextTransform = 'none' | 'uppercase'

export type TextSizingMode = 'auto' | 'fixed'

export interface TextPlaceholder extends PageElementBase {
  type: 'text-placeholder' | 'title-placeholder' | 'subtitle-placeholder'
  label: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontItalic: boolean
  lineHeight: number
  letterSpacing: number
  textAlign: TextAlign
  verticalAlign: TextVerticalAlign
  textTransform: TextTransform
  textSizingMode: TextSizingMode
  color: string
  maxLength: number
  required: boolean
  defaultText?: string
  effect: TextEffect | null
}
