import type { AiTextPlaceholder, LengthConstraint } from '../models/ai-text-placeholder.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import { measureKonvaText } from './text-measure.util'

// Ordinary Russian prose (average word/sentence length) — the estimate is only as good as how
// closely this resembles what YandexGPT will actually write.
const SAMPLE_PROSE =
  'Мы познакомились тёплым летним вечером, когда город уже начинал засыпать, а в парке ещё играла ' +
  'музыка. С тех пор многое изменилось: появились новые привычки, общие друзья и любимые места, ' +
  'куда хочется возвращаться снова и снова. Каждый день приносит что-то своё, и именно из таких ' +
  'мелочей складывается наша история. '

const SAMPLE_REPEATS = 40
// Leaves room for the variance between the sample and real generated text (longer words wrap
// earlier), so a box filled to the estimate doesn't overflow.
const SAFETY_FACTOR = 0.9
const MIN_SHARE = 0.8

export interface AiTextBoxCapacity {
  characters: number
  words: number
}

/** How much prose fits in `element`'s box at its current typography — binary search over a prefix
 * of the sample, measured with the same Konva.Text wrapping the canvas uses. */
export function estimateAiTextBoxCapacity(element: AiTextPlaceholder): AiTextBoxCapacity {
  const textElement = element as unknown as TextPlaceholder
  const rawSample = SAMPLE_PROSE.repeat(SAMPLE_REPEATS)
  const sample = element.textTransform === 'uppercase' ? rawSample.toUpperCase() : rawSample
  const { width, height } = element.size

  const fits = (length: number): boolean =>
    measureKonvaText({ text: sample.slice(0, length), element: textElement, maxWidth: width }).textHeight <= height

  let low = 0
  let high = sample.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (fits(middle)) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  const characters = Math.floor(low * SAFETY_FACTOR)
  const words = sample.slice(0, characters).trim().split(/\s+/).filter(Boolean).length
  return { characters, words: characters > 0 ? words : 0 }
}

/** Something below an ai-text box its text could run into — absolute page coordinates. */
export interface AiTextObstacle {
  x: number
  y: number
  width: number
  height: number
  kind: 'photo' | 'text'
}

/** Where `element` sits — what's around it on the page. See ai-text-overflow.util.ts's
 * `buildAiTextFitContext`, which collects it from a materialized canvas. */
export interface AiTextFitContext {
  /** Lowest y the text may reach before running into the print crop zone. */
  pageBottomLimit: number
  obstacles: AiTextObstacle[]
}

/** A real problem with a too-long text — not "longer than the admin's box", which is fine as long
 * as the space below is free: the box only sets the text's width, Konva (and so the print)
 * doesn't clip its height. */
export type AiTextFitIssue = 'overlap-photo' | 'overlap-text' | 'page-edge'

export interface AiTextFit {
  /** The text is taller than the admin's box (informational — not a problem on its own). */
  exceedsBox: boolean
  issue: AiTextFitIssue | null
  /** Roughly how many words to cut to resolve `issue` — 0 when there's none. */
  excessWords: number
}

export const AI_TEXT_FIT_ISSUE_LABELS: Record<AiTextFitIssue, string> = {
  'overlap-photo': 'Текст наезжает на фото',
  'overlap-text': 'Текст наезжает на соседний текст',
  'page-edge': 'Текст выходит за край страницы и обрежется при печати',
}

// Konva rounds line metrics — a text that exactly fills the box can measure a hair taller.
const FIT_TOLERANCE_PX = 1
// Horizontal overlap below which an element merely touching the text column isn't "in the way".
const MIN_HORIZONTAL_OVERLAP_PX = 4

/**
 * How `text` (the real generated/edited content) sits on the page, measured with the same
 * Konva.Text wrapping the print render (the chromeless editor canvas) uses. The text grows DOWN
 * from the box's top (no height is set on the Konva node), so past the box it only matters what's
 * underneath: the first photo/text below the box in the same column, or the page's crop zone.
 * Anything already overlapping the box itself is the admin's own design (a caption over a photo)
 * and is ignored. A rotated box is only measured against its own height.
 */
export function analyzeAiTextFit(
  element: AiTextPlaceholder,
  text: string,
  context: AiTextFitContext | null,
): AiTextFit {
  const trimmed = text.trim()
  if (!trimmed) {
    return { exceedsBox: false, issue: null, excessWords: 0 }
  }

  const textElement = element as unknown as TextPlaceholder
  const content = element.textTransform === 'uppercase' ? trimmed.toUpperCase() : trimmed
  const { width, height } = element.size
  const heightOf = (value: string): number =>
    measureKonvaText({ text: value, element: textElement, maxWidth: width }).textHeight

  const textHeight = heightOf(content)
  if (textHeight <= height + FIT_TOLERANCE_PX) {
    return { exceedsBox: false, issue: null, excessWords: 0 }
  }
  if (!context || element.rotation) {
    return { exceedsBox: true, issue: null, excessWords: 0 }
  }

  const boxTop = element.position.y
  const boxBottom = boxTop + height
  const blocking = context.obstacles
    .filter(
      (obstacle) =>
        obstacle.y >= boxBottom - FIT_TOLERANCE_PX &&
        Math.min(obstacle.x + obstacle.width, element.position.x + width) - Math.max(obstacle.x, element.position.x) >=
          MIN_HORIZONTAL_OVERLAP_PX,
    )
    .sort((a, b) => a.y - b.y)[0]

  const pageRoom = context.pageBottomLimit - boxTop
  const obstacleRoom = blocking ? blocking.y - boxTop : Infinity
  const room = Math.min(pageRoom, obstacleRoom)

  if (textHeight <= room + FIT_TOLERANCE_PX) {
    return { exceedsBox: true, issue: null, excessWords: 0 }
  }

  const issue: AiTextFitIssue =
    obstacleRoom <= pageRoom ? (blocking!.kind === 'photo' ? 'overlap-photo' : 'overlap-text') : 'page-edge'

  // End offset of every word, so a prefix keeps the original spacing and line breaks.
  const wordEnds = [...content.matchAll(/\S+/g)].map((match) => match.index! + match[0].length)
  let low = 0
  let high = wordEnds.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (heightOf(content.slice(0, wordEnds[middle - 1])) <= room + FIT_TOLERANCE_PX) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  return { exceedsBox: true, issue, excessWords: Math.max(wordEnds.length - low, 1) }
}

/** A length constraint in the element's current unit that fills its box: max = estimated capacity,
 * min = 80% of it. */
export function buildLengthConstraintForBox(element: AiTextPlaceholder): LengthConstraint {
  const capacity = estimateAiTextBoxCapacity(element)
  const max = element.lengthConstraint.unit === 'words' ? capacity.words : capacity.characters
  return {
    unit: element.lengthConstraint.unit,
    min: max > 0 ? Math.floor(max * MIN_SHARE) : null,
    max: max > 0 ? max : null,
  }
}
