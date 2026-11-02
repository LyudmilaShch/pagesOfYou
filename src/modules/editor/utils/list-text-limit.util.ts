import type { ListTextLimit } from '../models'

export function countWords(value: string): number {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** How much of the limit `value` uses — characters or words. */
export function limitUsage(value: string, limit: ListTextLimit): number {
  return limit.unit === 'words' ? countWords(value) : value.length
}

/**
 * `value` cut to the limit. Words: everything after the last allowed word goes — but the space a
 * customer types right after it stays (they may be about to delete or rewrite), so typing never
 * feels like it fights back; only a word beyond the limit is dropped.
 */
export function clampToLimit(value: string, limit: ListTextLimit): string {
  if (limit.max <= 0) {
    return value
  }
  if (limit.unit === 'characters') {
    return value.slice(0, limit.max)
  }
  let words = 0
  for (const match of value.matchAll(/\S+/g)) {
    words += 1
    if (words === limit.max) {
      const end = match.index! + match[0].length
      const rest = value.slice(end)
      return /\S/.test(rest) ? value.slice(0, end) + (rest.match(/^\s*/)?.[0] ?? '') : value
    }
  }
  return value
}

export function describeLimit(limit: ListTextLimit): string {
  return limit.unit === 'words' ? `до ${limit.max} слов` : `до ${limit.max} символов`
}
