import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isAiTextElement } from '@/modules/editor/models'
import type { AiTextPlaceholder } from '@/modules/editor/models/ai-text-placeholder.model'
import { getAiTextSiblingParts } from '@/modules/editor/utils/ai-text-chain.util'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'

import type { AiUsageStatus, GenerateDraftAiTextPayload } from '../api/ai-texts.api'
import { aiAnswersSignature } from './ai-answers-signature.util'
import type { JournalPage, QuestionAnswer } from '../types/order.types'

// Same cap as the backend's MAX_JOURNAL_CONTEXT_CHARS — anything past it would be dropped there.
const MAX_JOURNAL_CONTEXT_CHARS = 4000

/** Every generated text on `page`, each as its parts in reading order — a standalone block is a
 * group of one. Mirrors the backend's `groupAiTextLeaves`. */
export function aiTextGroupsOf(page: JournalPage): AiTextPlaceholder[][] {
  const elements = normalizeCanvasData(page.pageSnapshot).elements
  const groups: AiTextPlaceholder[][] = []
  const seen = new Set<string>()
  for (const leaf of flattenTree(elements)) {
    if (!isAiTextElement(leaf) || seen.has(leaf.id)) {
      continue
    }
    const parts = getAiTextSiblingParts(elements, leaf)
    parts.forEach((part) => seen.add(part.id))
    groups.push(parts)
  }
  return groups
}

export function textOf(page: JournalPage, elementId: string): string {
  return page.placeholderValues.find((value) => value.elementId === elementId)?.textValue?.trim() ?? ''
}

/**
 * - `missing` — every question answered, no text yet: the next generation writes its first version.
 * - `outdated` — written from answers that have since changed: the next generation updates it
 *   (if the limit/the guest's budget allows — otherwise it stays flagged as outdated).
 * - `up-to-date` — written from exactly the current answers.
 */
export type AiTextGenerationState = 'missing' | 'outdated' | 'up-to-date'

export interface AiTextGroupStatus {
  journalPageId: string
  parts: AiTextPlaceholder[]
  /** The parts generation may write — every part but the hand-edited ones. */
  writableParts: AiTextPlaceholder[]
  sourceHash: string
  state: AiTextGenerationState
  /** The most automatic updates any writable part already had (a guest's per-block budget). */
  autoUpdates: number
}

/**
 * Where every question-driven AI text stands against `answerByKey` — the same rule the backend's
 * `OrdersService.generateAiTextForElements` applies. Texts still waiting for an answer, written
 * from the whole journal, or fully hand-edited are left out. A text written before answers were
 * fingerprinted (no `aiSourceHash`) counts as outdated only when one of `changedKeys` feeds it.
 */
export function questionAiTextStatuses(
  pages: JournalPage[],
  answerByKey: ReadonlyMap<string, string | null | undefined>,
  changedKeys: ReadonlySet<string> = new Set(),
): AiTextGroupStatus[] {
  const statuses: AiTextGroupStatus[] = []
  for (const page of pages) {
    const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
    for (const parts of aiTextGroupsOf(page)) {
      const lead = parts[0]
      if (
        lead.contentSource === 'journal' ||
        lead.questionKeys.length === 0 ||
        !lead.questionKeys.every((key) => answerByKey.get(key)?.trim())
      ) {
        continue
      }
      const writableParts = parts.filter((part) => valueByElementId.get(part.id)?.source !== 'OVERRIDDEN')
      if (writableParts.length === 0) {
        continue
      }

      const sourceHash = aiAnswersSignature(lead.questionKeys, answerByKey)
      const feedsChange = lead.questionKeys.some((key) => changedKeys.has(key))
      const values = writableParts.map((part) => valueByElementId.get(part.id))
      const state: AiTextGenerationState = values.every((value) => !value?.textValue?.trim())
        ? 'missing'
        : values.every(
              (value) =>
                value?.textValue?.trim() &&
                (value.aiSourceHash ? value.aiSourceHash === sourceHash : !feedsChange),
            )
          ? 'up-to-date'
          : 'outdated'

      statuses.push({
        journalPageId: page.id,
        parts,
        writableParts,
        sourceHash,
        state,
        autoUpdates: Math.max(0, ...values.map((value) => value?.aiAutoUpdates ?? 0)),
      })
    }
  }
  return statuses
}

export function answerMapOf(answers: QuestionAnswer[]): Map<string, string | null> {
  return new Map(answers.map((answer) => [answer.questionKey, answer.textValue]))
}

const UNWRITTEN_MESSAGE =
  'Текст не создан — сегодня ИИ уже не может писать новые тексты. Напишите его вручную (✏️) или вернитесь завтра'
const OUTDATED_GUEST_MESSAGE =
  'Текст написан по прежнему ответу. Войдите, чтобы обновить его (🔄), или поправьте вручную (✏️)'
const OUTDATED_USER_MESSAGE =
  'Текст написан по прежнему ответу — лимит перегенераций на сегодня исчерпан. Поправьте его вручную (✏️) или обновите завтра (🔄)'

export interface AiTextMarkers {
  /** journalPageId → ai-text ids the next generation will write (see the questionnaire's step
   * leave) — the book's "напишем после «Далее»" badge. */
  awaitingByPageId: Map<string, Set<string>>
  /** journalPageId → (ai-text id → why it won't be written for now) — the book's ⚠ markers. */
  messagesByPageId: Map<string, Map<string, string>>
  /** Parts left empty by the hidden daily cap on first texts. */
  unwrittenCount: number
  /** Question keys feeding a text that stays on an earlier answer (no updates left). */
  outdatedQuestionKeys: Set<string>
}

/**
 * What the book shows for every AI text that isn't simply up to date: awaiting the next
 * generation, or flagged because it can't be written right now — a missing text past the hidden
 * cap, or an outdated one past the guest's per-block updates / the customer's regeneration
 * limit. Journal-wide texts (cover lines) only count once `includeJournal` (the questionnaire is
 * finished). `excludeIds` — texts mid-generation, which show their own shimmer instead.
 */
export function buildAiTextMarkers(
  pages: JournalPage[],
  answerByKey: ReadonlyMap<string, string | null | undefined>,
  usage: AiUsageStatus | null,
  isGuest: boolean,
  options: { includeJournal: boolean; excludeIds?: ReadonlySet<string> },
): AiTextMarkers {
  const markers: AiTextMarkers = {
    awaitingByPageId: new Map(),
    messagesByPageId: new Map(),
    unwrittenCount: 0,
    outdatedQuestionKeys: new Set(),
  }
  const excludeIds = options.excludeIds ?? new Set<string>()
  const canFill = !usage?.fillCapReached
  const flag = (pageId: string, ids: string[], message: string) => {
    const messages = markers.messagesByPageId.get(pageId) ?? new Map<string, string>()
    ids.forEach((id) => messages.set(id, message))
    markers.messagesByPageId.set(pageId, messages)
  }

  for (const status of questionAiTextStatuses(pages, answerByKey)) {
    const ids = status.writableParts.map((part) => part.id).filter((id) => !excludeIds.has(id))
    if (status.state === 'up-to-date' || ids.length === 0) {
      continue
    }
    // Allowance not fetched yet → assume there's room; the server still has the final say.
    const canUpdate = isGuest
      ? status.autoUpdates < (usage?.guestAutoUpdatesPerText ?? Infinity)
      : (usage?.remaining ?? 1) > 0
    const canGenerate = status.state === 'missing' ? canFill : canUpdate

    if (canGenerate) {
      const awaiting = markers.awaitingByPageId.get(status.journalPageId) ?? new Set<string>()
      ids.forEach((id) => awaiting.add(id))
      markers.awaitingByPageId.set(status.journalPageId, awaiting)
    } else if (status.state === 'missing') {
      flag(status.journalPageId, ids, UNWRITTEN_MESSAGE)
      markers.unwrittenCount += ids.length
    } else {
      flag(status.journalPageId, ids, isGuest ? OUTDATED_GUEST_MESSAGE : OUTDATED_USER_MESSAGE)
      status.parts[0].questionKeys.forEach((key) => markers.outdatedQuestionKeys.add(key))
    }
  }

  if (options.includeJournal && !canFill) {
    for (const page of pages) {
      const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
      for (const parts of aiTextGroupsOf(page)) {
        if (parts[0].contentSource !== 'journal') {
          continue
        }
        const ids = parts
          .filter((part) => {
            const value = valueByElementId.get(part.id)
            return !value?.textValue?.trim() && value?.source !== 'OVERRIDDEN' && !excludeIds.has(part.id)
          })
          .map((part) => part.id)
        if (ids.length > 0) {
          flag(page.id, ids, UNWRITTEN_MESSAGE)
          markers.unwrittenCount += ids.length
        }
      }
    }
  }

  return markers
}

/** Two pages' worth of ⚠ messages in one — `primary`'s message wins where both flag a text. */
export function mergeTextIssueMessages(
  primary: Map<string, Map<string, string>>,
  secondary: Map<string, Map<string, string>>,
): Map<string, Map<string, string>> {
  const result = new Map(secondary)
  for (const [pageId, messages] of primary) {
    result.set(pageId, new Map([...(secondary.get(pageId) ?? []), ...messages]))
  }
  return result
}

/** The page part of a draft generation request — template ids only, never the snapshot. */
export function draftPagePayload(page: JournalPage): GenerateDraftAiTextPayload['page'] {
  return {
    slotType: page.slotType,
    layoutMode: page.layoutMode,
    magazinePageId: page.magazinePage.id,
    rightMagazinePageId: page.rightMagazinePage?.id ?? null,
  }
}

export function draftAnswersPayload(answers: QuestionAnswer[]): GenerateDraftAiTextPayload['answers'] {
  return answers
    .filter((answer) => answer.textValue?.trim())
    .map((answer) => ({ questionKey: answer.questionKey, textValue: answer.textValue ?? undefined }))
}

/** The journal's other AI texts, for a journal-wide text's prompt — mirrors the backend's
 * `collectJournalTexts` (skips `ownIds` and other journal-wide texts, same length cap). */
export function collectDraftJournalTexts(pages: JournalPage[], ownIds: Set<string>): string[] {
  const texts: string[] = []
  let length = 0
  for (const page of pages) {
    for (const parts of aiTextGroupsOf(page)) {
      if (parts[0].contentSource === 'journal' || parts.some((part) => ownIds.has(part.id))) {
        continue
      }
      const text = parts.map((part) => textOf(page, part.id)).filter(Boolean).join(' ')
      if (text && length + text.length <= MAX_JOURNAL_CONTEXT_CHARS) {
        texts.push(text)
        length += text.length
      }
    }
  }
  return texts
}
