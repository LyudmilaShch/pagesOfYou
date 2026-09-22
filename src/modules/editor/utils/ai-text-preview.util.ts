import type { LengthConstraint } from '../models/ai-text-placeholder.model'

const AI_TEXT_PLACEHOLDER_PHRASE =
  'Здесь появится текст, сгенерированный на основе заполненной анкеты. После заполнения всех ' +
  'необходимых полей система подготовит содержательный материал, учитывающий указанные данные, ' +
  'предпочтения и требования. Этот текст будет заменён автоматически после завершения генерации. '

// Purely a preview placeholder — capped well below whatever the length constraint's admin-typed
// `max` actually says (a plain number input with no upper bound — see
// EditorAiTextConfigScreen.vue's "Максимум" field), for two separate reasons: a non-finite value
// (typing "1e1000" parses to `Infinity`) must never reach the loop-free builders below, AND —
// the one a much higher cap here still missed — the admin template editor renders this preview
// inside the element's own (often small, unresized-from-default 80×28px) box with word-wrap
// forced on (see element-node.adapter.ts's `textSizingMode: 'fixed'` override), so Konva has to
// lay the whole thing out across as many lines as that width allows. A cap in the thousands still
// means hundreds of wrapped lines recomputed on every keystroke in that box — slow enough to feel
// like a hang. These caps keep it to a couple dozen lines at most, worst case.
const CHARACTERS_PREVIEW_CAP = 400
const WORDS_PREVIEW_CAP = 80

/** Before any real generation exists, both the customer's book (see merge-placeholder-element.util.ts)
 * AND the admin template editor (see element-node.adapter.ts's `ai-text-placeholder` branch) show
 * this — repeated out to the element's own configured max length — instead of the admin's raw
 * `previewPlaceholderText` field, so a short admin label doesn't leave the box looking emptier
 * than the real generated text will actually make it. Built with `repeat()` (bounded, throws
 * instead of hanging on a bad count) rather than a `while` loop, which would spin forever given a
 * non-finite `max`. */
export function buildAiTextFallbackPreview(constraint: LengthConstraint): string {
  const rawMax = constraint.max
  if (!rawMax || !Number.isFinite(rawMax) || rawMax <= 0) {
    return AI_TEXT_PLACEHOLDER_PHRASE.trim()
  }

  if (constraint.unit === 'words') {
    const max = Math.min(rawMax, WORDS_PREVIEW_CAP)
    const phraseWords = AI_TEXT_PLACEHOLDER_PHRASE.trim().split(/\s+/)
    const repeats = Math.ceil(max / phraseWords.length)
    const words = Array.from({ length: repeats }, () => phraseWords).flat()
    return words.slice(0, max).join(' ')
  }

  const max = Math.min(rawMax, CHARACTERS_PREVIEW_CAP)
  const repeats = Math.ceil(max / AI_TEXT_PLACEHOLDER_PHRASE.length)
  return AI_TEXT_PLACEHOLDER_PHRASE.repeat(repeats).slice(0, max).trimEnd()
}
