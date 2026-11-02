/** One item of a LIST answer: a title (the row's 'item' text) and an optional description (its
 * 'detail' text). Stored as a plain string when there's no description — which is also how every
 * answer saved before descriptions existed looks. Mirrors the backend's list-order.util.ts. */
export interface ListAnswerEntry {
  title: string
  text: string
}

export type StoredListItem = string | { title: string; text: string }

export function toListEntries(items: unknown): ListAnswerEntry[] {
  if (!Array.isArray(items)) {
    return []
  }
  return items.map((item) => {
    if (typeof item === 'string') {
      return { title: item, text: '' }
    }
    const entry = (item ?? {}) as { title?: unknown; text?: unknown }
    return {
      title: typeof entry.title === 'string' ? entry.title : '',
      text: typeof entry.text === 'string' ? entry.text : '',
    }
  })
}

/** Back to the stored shape, blanks kept (the questionnaire's inputs mustn't vanish while typing;
 * the backend drops them on save). */
export function fromListEntries(entries: ListAnswerEntry[]): StoredListItem[] {
  return entries.map((entry) => (entry.text ? { title: entry.title, text: entry.text } : entry.title))
}

export function isListEntryFilled(entry: ListAnswerEntry): boolean {
  return Boolean(entry.title.trim() || entry.text.trim())
}

/** One line per filled entry — "title — description" — as the backend stores it in `textValue`. */
export function listEntriesText(entries: ListAnswerEntry[]): string {
  return entries
    .map((entry) => [entry.title.trim(), entry.text.trim()].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n')
}
