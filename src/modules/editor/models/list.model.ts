/** Where k filled rows go among the N template rows (per column — see list-distribution.util.ts):
 * 'slots' — onto k of the template's own row places, evenly picked; 'path' — evenly along the
 * line through all the places, in between them too; 'start' — the first k places; 'center' — k
 * places in the middle. */
export type ListLayoutMode = 'slots' | 'path' | 'start' | 'center'

/**
 * An auto-distributed list. There's no list container: its rows are ordinary page elements (a small
 * group "number + text", or a single text) sharing a `listId`, read in `listOrder` — like the parts
 * of a chained AI text. These settings are list-wide, mirrored onto every row by the editor; the
 * first row's are authoritative. See list-distribution.util.ts.
 */
export interface ListSettings {
  /** The LIST question whose items fill the rows — mirrored onto every row's 'item' text. */
  questionKey: string | null
  /** Fewest items the customer must fill (0/unset — none); makes the question required. The most is
   * the row count. */
  minItems?: number
  /** Unset — 'slots'. */
  mode?: ListLayoutMode
  /** Admin-picked places for a given item count: count → the rows (their ids — so reordering rows
   * keeps the pick; templates saved earlier hold 0-based row indices). Overrides `mode` for that
   * count; ignored unless it names exactly `count` distinct, existing rows. */
  slotsByCount?: Record<string, Array<string | number>>
  /** "Предложить пункты" in the questionnaire (AI-written items). Unset — shown. */
  suggestEnabled?: boolean
  /** The admin's instruction for those items — what they should be like. Unset/blank — the
   * default below. The list's name (its question), the answers, the items already written and the
   * length limit are always added around it. */
  suggestPrompt?: string
}

/** Mirrored in the backend's orders.service.ts (DEFAULT_LIST_SUGGEST_PROMPT) — keep in sync. */
export const DEFAULT_LIST_SUGGEST_PROMPT =
  'Пункты — короткие и тёплые, по делу, на языке ответов: 1–5 слов, без нумерации, без повторов, ' +
  'каждый о своём. Опирайся на факты из ответов, ничего не выдумывай.'
