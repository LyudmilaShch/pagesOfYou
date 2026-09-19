import type { PageElementBase } from './page-element.model'
import type { TextAlign, TextSizingMode, TextTransform, TextVerticalAlign } from './text-placeholder.model'
import type { TextEffect } from './text-effect.model'

export type LengthConstraintUnit = 'characters' | 'words'

export interface LengthConstraint {
  unit: LengthConstraintUnit
  min: number | null
  max: number | null
}

/**
 * AI-generated text block: admin defines a prompt template + which questions feed it, the actual
 * generated text is written back as a normal TEXT PlaceholderValue (source: AI, future phase).
 * A distinct type (not a flag on TextPlaceholder) because it needs different admin controls
 * (prompt, question picker, length constraint) and has no required/defaultText/maxLength — it is
 * never directly user-fillable.
 */
export interface AiTextPlaceholder extends PageElementBase {
  type: 'ai-text-placeholder'
  label: string
  prompt: string
  questionKeys: string[]
  lengthConstraint: LengthConstraint
  /** Static text shown on-canvas before any generation exists. */
  previewPlaceholderText?: string

  // Same typography fields as TextPlaceholder (deliberately duplicated, not inherited).
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
  effect: TextEffect | null
}
