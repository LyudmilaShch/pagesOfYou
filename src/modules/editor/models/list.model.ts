/** Where k filled rows go among the N template rows (per column — see list-distribution.util.ts):
 * 'slots' — onto k of the template's own row places, evenly picked; 'path' — evenly along the
 * line through all the places, in between them too; 'start' — the first k places; 'center' — k
 * places in the middle. */
export type ListLayoutMode = 'slots' | 'path' | 'start' | 'center'

export type ListHeightMode = 'fixed' | 'text'

/** 'spread' — first row at the area's top, last at its bottom, equal gaps; 'top' / 'center' — the
 * template's own spacing, the block at the top / in the middle of the area. */
export type ListFlowAlign = 'spread' | 'top' | 'center'

/** How long an item's title or description may be — in characters or words. */
export interface ListTextLimit {
  unit: 'characters' | 'words'
  max: number
}

export const DEFAULT_LIST_MIN_GAP = 6
export const DEFAULT_LIST_MIN_FONT_SCALE = 0.85

/**
 * An auto-distributed list. There's no list container: its rows are ordinary page elements (a small
 * group "number + text", or a single text) sharing a `listId`, read in `listOrder` — like the parts
 * of a chained AI text. These settings are list-wide, mirrored onto every row by the editor; the
 * first row's are authoritative. See list-distribution.util.ts.
 */
/** 'question' (unset) — rows fill from a LIST answer. 'toc' — rows are a table of contents:
 * titles and page numbers are written from the journal at render time, and the list's layout
 * (two pages, placement, gaps, font) is the whole of the contents' behaviour. */
export type ListSource = 'question' | 'toc'

/** How a contents row prints its page number. Unset — `plain` (`3`). */
export type TocNumberFormat = 'plain' | 'pad2' | 'page'

/** What a long section title does inside its box. Unset — `wrap` (the row grows with the lines). */
export type TocTitleFit = 'wrap' | 'shrink'

export interface ListSettings {
  /** The LIST question whose items fill the rows — mirrored onto every row's 'item' text.
   * Null for a table of contents (`source: 'toc'`), which has no question. */
  questionKey: string | null
  /** Unset — 'question'. */
  source?: ListSource
  /** Fewest items the customer must fill (0/unset — none); makes the question required. The most is
   * the row count. */
  minItems?: number
  /** Unset — 'slots'. */
  mode?: ListLayoutMode
  /** Admin-picked places for a given item count: count → the rows (their ids — so reordering rows
   * keeps the pick; templates saved earlier hold 0-based row indices). Overrides `mode` for that
   * count; ignored unless it names exactly `count` distinct, existing rows. */
  slotsByCount?: Record<string, Array<string | number>>
  /** 'fixed' (unset) — filled rows sit exactly on their template places. 'text' — each column's
   * template area (top of its first row to bottom of its last) stays put, and the rows are
   * re-stacked inside it by their real text height (x still from their places); vertical columns
   * only. See list-distribution.util.ts. */
  heightMode?: ListHeightMode
  /** With heightMode 'text': where the rows go when they take less room than the area. Unset — 'spread'. */
  flowAlign?: ListFlowAlign
  /** With heightMode 'text': the smallest gap between rows, in page points. Unset — 6. */
  minGap?: number
  /** With heightMode 'text': how far the descriptions' (or, without descriptions, the titles')
   * font may shrink when the rows don't fit even with minimal gaps (0.5–1). Unset — 0.85. */
  minFontScale?: number
  /** Length limits of an item's title / description — enforced in the questionnaire, given to the
   * AI suggestions and used by the editor's "long text" preview. Unset — the texts' own `maxLength`
   * in characters (as before limits existed). */
  titleLimit?: ListTextLimit | null
  detailLimit?: ListTextLimit | null
  /** "Предложить пункты" in the questionnaire (AI-written items). Unset — shown. */
  suggestEnabled?: boolean
  /** The admin's instruction for those items — what they should be like. Unset/blank — the
   * default below. The list's name (its question), the answers, the items already written and the
   * length limit are always added around it. */
  suggestPrompt?: string
  /** Contents only. Unset — `plain`. */
  numberFormat?: TocNumberFormat
  /** Contents only. Unset — `wrap`. */
  titleFit?: TocTitleFit
  /** Contents only. A line under each title. Unset — off. The text comes from the spread or page. */
  showDescription?: boolean
}

/** Mirrored in the backend's orders.service.ts (DEFAULT_LIST_SUGGEST_PROMPT) — keep in sync. */
export const DEFAULT_LIST_SUGGEST_PROMPT =
  'Пункты — короткие и тёплые, по делу, на языке ответов: 1–5 слов, без нумерации, без повторов, ' +
  'каждый о своём. Опирайся на факты из ответов, ничего не выдумывай.'
