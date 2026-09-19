import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import type { JournalPage, QuestionAnswer } from '../types/order.types'
import type { Question } from '../types/question.types'

export interface QuestionnaireStep {
  /** The journal page (spread/cover/back-cover) this step's questions belong to — what the book
   * jumps to while this step is open, and what "N из M" counts against. */
  journalPageId: string
  /** Every question homed on this journal page (its own `magazinePage` and, for a SPLIT_PAGES
   * spread, `rightMagazinePage` too), shown together on one wizard screen. */
  questions: Question[]
}

export interface QuestionnaireFlow {
  /** One journal page — one wizard screen: every question belonging to that page/spread is
   * answered together, ordered the same way the journal itself is ordered (`journalPages` order,
   * then each page's questions in catalog order). A page with no questions of its own is skipped
   * entirely, so step count and journal page count can differ. */
  steps: QuestionnaireStep[]
  /** journalPageId -> questionKey[] bound to elements on that spread — the static per-spread
   * fill-denominator (used for the "N of M answered" badge), built once here rather than
   * recomputed on every answer. */
  pageQuestionKeys: Map<string, string[]>
  /** questionKey -> journalPageId[] — the reverse lookup, used to highlight/pulse the spreads a
   * question's answer actually lands on. */
  affectedPageIds: Map<string, string[]>
  /** questionKey -> the ai-text-placeholder elements that read it (via their own `questionKeys`
   * list, not the direct `questionKey` field the maps above scan for). Lets the questionnaire mark
   * exactly those elements "pending" for the (potentially several-second) YandexGPT round-trip a
   * save triggers server-side, instead of just going straight from stale to generated text with no
   * indication anything is happening — see QuestionnairePage.vue's `pendingAiElementIds`. */
  aiTextElementsByQuestionKey: Map<string, Array<{ pageId: string; elementId: string }>>
}

/** Builds the wizard order and the question<->spread cross-reference caches in a single pass over
 * `journalPages`, ordered the way the journal itself is ordered.
 *
 * A `Question` has no page of its own (one question may be referenced by elements on several
 * pages, see `Question` in `question.types.ts`) — so a question's wizard-step placement is derived
 * here, not read off the question: it's homed on the FIRST page, in journal order, where a
 * matching canvas element is actually found (scanning `questionKey`/`questionKeys` the same way as
 * `pageQuestionKeys`/`affectedPageIds` below). A question with no bound element anywhere has no
 * home and is skipped from `steps` entirely — nothing would consume its answer either. Within that,
 * `steps` is de-duplicated by key GLOBALLY (not just within a page): several journal pages can
 * share the same admin magazine-page template (e.g. the same "Разворот" layout reused for spreads
 * 1, 4 and 7, or a question bound to both the cover and the back cover) — without this, the SAME
 * question would be pushed into a step once per page it appears on, inflating `totalQuestions` and
 * making the progress bar/counter jump to "complete" early.
 *
 * `pageQuestionKeys`/`affectedPageIds`, unlike `steps`, record EVERY page a key's element appears
 * on (not just the first) — that's what the live filmstrip overlay needs. An `ai-text-placeholder`
 * references questions indirectly via its own `questionKeys` list, not a direct `questionKey`
 * field (same exclusion as the backend's `matchesQuestionKey`), so it never gets a live text
 * overlay, which is correct: its text only exists after an async YandexGPT round-trip, not
 * instantly on keystroke — it's tracked separately in `aiTextElementsByQuestionKey` instead. */
export function buildQuestionnaireFlow(
  journalPages: JournalPage[],
  questions: Question[],
): QuestionnaireFlow {
  const pageQuestionKeys = new Map<string, string[]>()
  const affectedPageIds = new Map<string, string[]>()
  const aiTextElementsByQuestionKey = new Map<string, Array<{ pageId: string; elementId: string }>>()
  const questionByKey = new Map(questions.map((question) => [question.key, question]))

  const steps: QuestionnaireStep[] = []
  const seenStepKeys = new Set<string>()

  for (const page of journalPages) {
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    const keysOnPage: string[] = []
    const stepQuestions: Question[] = []

    const registerKey = (key: string): void => {
      if (!questionByKey.has(key) || keysOnPage.includes(key)) {
        return
      }
      keysOnPage.push(key)

      const pages = affectedPageIds.get(key)
      if (pages) {
        pages.push(page.id)
      } else {
        affectedPageIds.set(key, [page.id])
      }

      if (!seenStepKeys.has(key)) {
        seenStepKeys.add(key)
        stepQuestions.push(questionByKey.get(key)!)
      }
    }

    for (const leaf of leaves) {
      if (leaf.type === 'ai-text-placeholder') {
        for (const key of leaf.questionKeys) {
          if (!questionByKey.has(key)) {
            continue
          }
          registerKey(key)

          const elements = aiTextElementsByQuestionKey.get(key)
          const entry = { pageId: page.id, elementId: leaf.id }
          if (elements) {
            elements.push(entry)
          } else {
            aiTextElementsByQuestionKey.set(key, [entry])
          }
        }
        continue
      }

      const key = 'questionKey' in leaf ? leaf.questionKey : undefined
      if (key) {
        registerKey(key)
      }
    }

    if (keysOnPage.length > 0) {
      pageQuestionKeys.set(page.id, keysOnPage)
    }
    if (stepQuestions.length > 0) {
      steps.push({ journalPageId: page.id, questions: stepQuestions })
    }
  }

  return { steps, pageQuestionKeys, affectedPageIds, aiTextElementsByQuestionKey }
}

export function isQuestionAnswered(
  question: Question,
  answers: Map<string, QuestionAnswer>,
): boolean {
  const answer = answers.get(question.key)
  if (!answer) {
    return false
  }

  if (question.type === 'IMAGE') {
    return Boolean(answer.jsonValue?.url)
  }

  if (question.type === 'GALLERY') {
    return Boolean(answer.jsonValue?.urls?.length)
  }

  return Boolean(answer.textValue?.trim())
}
