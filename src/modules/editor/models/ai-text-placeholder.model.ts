import type { PageElementBase } from './page-element.model'
import type { TextAlign, TextSizingMode, TextTransform, TextVerticalAlign } from './text-placeholder.model'
import type { TextEffect } from './text-effect.model'

export type LengthConstraintUnit = 'characters' | 'words'

/** How a chain's parts relate: 'continuous' — one text split into consecutive pieces (columns);
 * 'phrases' — independent short phrases on one theme (e.g. cover lines about the person). */
export type AiTextChainMode = 'continuous' | 'phrases'

/** What the text is generated from: 'questions' — answers to its own `questionKeys`, generated as
 * soon as they're answered; 'journal' — the whole questionnaire plus the journal's other generated
 * texts, generated once the questionnaire is finished (e.g. cover lines). For 'journal',
 * `questionKeys` are optional extra wishes, asked as the questionnaire's LAST step. */
export type AiTextContentSource = 'questions' | 'journal'

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
  /**
   * Links several ai-text-placeholders on the same page/spread into ONE generated text split into
   * parts (e.g. two columns on the left page + one on the right) — every part shares the same
   * `chainId`, and `prompt`/`questionKeys` are mirrored across all of them (see
   * ai-text-chain.util.ts), while `lengthConstraint` and typography stay per-part. `null` = a
   * standalone block. Reading order is `chainOrder` ascending — compared, never displayed as-is
   * (deleting a part leaves a gap, see getAiTextChainParts).
   */
  chainId: string | null
  chainOrder: number
  /** Chain-wide (mirrored across parts like `prompt`); ignored on a standalone block. */
  chainMode: AiTextChainMode
  /** Chain-wide (mirrored across parts like `prompt`). */
  contentSource: AiTextContentSource
  /** Optional, per-part (never mirrored): what THIS part of a chained text should be about, e.g.
   * "знакомство" or "пожелание на будущее" — added to the prompt next to the part's length. */
  partHint: string

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
