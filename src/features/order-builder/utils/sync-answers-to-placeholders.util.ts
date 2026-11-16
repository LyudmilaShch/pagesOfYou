import { isPhotoElement, isTextElement } from '@/modules/editor/models'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { listAnswerSlots } from '@/modules/editor/utils/list-distribution.util'

import type { JournalPage, PlaceholderValue, QuestionAnswer } from '../types/order.types'
import { toListEntries } from './list-answer.util'

/** How many list entries these slots consume (the next page continues after them). */
export function listAnswerRowCount(slots: Map<string, { entry: number }>): number {
  let rowCount = 0
  for (const slot of slots.values()) {
    rowCount = Math.max(rowCount, slot.entry + 1)
  }
  return rowCount
}

/**
 * Projects saved questionnaire answers onto the journal's placeholders. A guest's local draft has
 * no server round-trip to do this (see OrdersService.syncAnswersToPlaceholders) — without it the
 * live preview shows the typed text only until the autosave drops the overlay, and the template
 * stubs come back. A hand edit (`source: OVERRIDDEN`) is left alone. AI texts are not answers and
 * are not touched.
 */
export function syncAnswersOntoJournalPages(
  pages: JournalPage[],
  answers: QuestionAnswer[],
  questionKeys: readonly string[],
): void {
  if (questionKeys.length === 0) {
    return
  }

  const answerByKey = new Map(answers.map((answer) => [answer.questionKey, answer]))

  for (const key of questionKeys) {
    const answer = answerByKey.get(key) ?? null
    const listEntries = Array.isArray(answer?.jsonValue?.items) ? toListEntries(answer.jsonValue.items) : null
    const galleryUrls = Array.isArray(answer?.jsonValue?.urls) ? answer.jsonValue.urls : null
    let listEntryOffset = 0
    let matchIndex = 0

    for (const page of pages) {
      const elements = normalizeCanvasData(page.pageSnapshot).elements
      const slots = listAnswerSlots(elements, key)
      const rowCount = listAnswerRowCount(slots)

      const byElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))

      for (const leaf of flattenTree(elements)) {
        const isText = isTextElement(leaf)
        const isPhoto = isPhotoElement(leaf)
        if ((!isText && !isPhoto) || leaf.questionKey !== key) {
          continue
        }

        const existing = byElementId.get(leaf.id)
        if (existing?.source === 'OVERRIDDEN') {
          matchIndex += 1
          continue
        }

        if (isPhoto) {
          const url = galleryUrls ? galleryUrls[matchIndex] : answer?.jsonValue?.url
          const trimmedUrl = typeof url === 'string' ? url.trim() : ''
          matchIndex += 1
          if (!trimmedUrl) {
            if (existing) {
              byElementId.delete(leaf.id)
            }
            continue
          }
          byElementId.set(leaf.id, {
            id: existing?.id ?? `local-answer-${page.id}-${leaf.id}`,
            elementId: leaf.id,
            valueType: 'PHOTO',
            textValue: null,
            jsonValue: { ...(existing?.jsonValue ?? {}), url: trimmedUrl },
            source: 'AUTO',
          })
          continue
        }

        matchIndex += 1
        const slot = listEntries ? slots.get(leaf.id) : undefined
        const textValue = slot
          ? listEntries![listEntryOffset + slot.entry]?.[slot.field]?.trim()
          : answer?.textValue?.trim()

        if (!textValue) {
          if (existing && existing.source !== 'AI') {
            byElementId.delete(leaf.id)
          }
          continue
        }

        const next: PlaceholderValue = {
          id: existing?.id ?? `local-answer-${page.id}-${leaf.id}`,
          elementId: leaf.id,
          valueType: 'TEXT',
          textValue,
          jsonValue: existing?.jsonValue ?? null,
          source: 'AUTO',
        }
        byElementId.set(leaf.id, next)
      }

      page.placeholderValues = [...byElementId.values()]
      listEntryOffset += rowCount
    }
  }
}
