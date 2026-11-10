/** Puts a newly uploaded gallery item at the front of a list that already shows the same gallery.
 * An id that is already there is left as-is, so a second notice for the same file does not
 * duplicate the row. */
export function prependUniqueById<T extends { id: string }>(items: readonly T[], item: T): T[] {
  if (items.some((existing) => existing.id === item.id)) {
    return [...items]
  }
  return [item, ...items]
}
