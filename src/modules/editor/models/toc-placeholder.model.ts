import type { PageElementBase } from './page-element.model'
import type { TextAlign, TextTransform, TextVerticalAlign } from './text-placeholder.model'
import type { TextEffect } from './text-effect.model'

/**
 * One row of a rendered table of contents — never stored on the element itself, always computed
 * at render time from the order's actual journal pages (see journal-structure.util.ts's
 * buildTocEntries), since the same template can back orders with different final spread counts.
 */
export interface TocEntry {
  pageId: string
  title: string
  /** Already formatted for display, e.g. "3–4" for a spread or "12" for a single page. */
  pageLabel: string
}

/**
 * Table-of-contents block: admin places it once, styles it (font, spacing, dot leader) — the
 * actual rows are never edited directly, they're assembled automatically from the other spreads'
 * own names and their real position in the finished book. A distinct type (not a text variant)
 * because its "content" is a computed list of rows, not a single string — but it gets the exact
 * same typography controls as TextPlaceholder/AiTextPlaceholder (same field set, deliberately
 * duplicated rather than inherited, same as AiTextPlaceholder's own fields — see that model's
 * comment), so admins configure it with the same font/color/effects UI they already know.
 */
export interface TocPlaceholder extends PageElementBase {
  type: 'toc-placeholder'
  label: string

  fontFamily: string
  fontSize: number
  fontWeight: number
  fontItalic: boolean
  letterSpacing: number
  lineHeight: number
  /** Alignment of each entry's title within its row — the page number always sits at the
   * opposite (trailing) edge, except with a dot leader, which always overrides this to a
   * title-left/number-right layout. */
  textAlign: TextAlign
  verticalAlign: TextVerticalAlign
  textTransform: TextTransform
  color: string
  effect: TextEffect | null

  /** Vertical gap between entries, in page points (same unit as `size`/`position`). */
  entryGap: number
  /** Dotted leader line filling the gap between a title and its page number. */
  dotLeader: boolean
}
