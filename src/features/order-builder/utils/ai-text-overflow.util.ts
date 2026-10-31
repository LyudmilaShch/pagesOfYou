import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { LeafElement } from '@/modules/editor/models'
import { isAiTextElement, isPhotoElement, isTextElement, isTocElement } from '@/modules/editor/models'
import { A4_PAGE_HEIGHT, PRINT_CROP_MARGIN } from '@/modules/editor/constants/page.constants'
import {
  AI_TEXT_FIT_ISSUE_LABELS,
  analyzeAiTextFit,
  type AiTextFitContext,
  type AiTextFitIssue,
  type AiTextObstacle,
} from '@/modules/editor/utils/ai-text-capacity.util'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'

import type { JournalPage } from '../types/order.types'

export interface AiTextFitProblem {
  journalPageId: string
  elementId: string
  issue: AiTextFitIssue
  excessWords: number
}

/** What a too-long text on this page could run into, besides `elementId` itself: every visible
 * photo slot and every text-bearing block (shapes are decoration — text crossing a background
 * rectangle is the admin's call, not a print defect). Leaves must be absolute (flattenTree). */
function obstacleFor(leaf: LeafElement): AiTextObstacle | null {
  if (!leaf.visible) {
    return null
  }
  const kind = isPhotoElement(leaf)
    ? 'photo'
    : isTextElement(leaf) || isAiTextElement(leaf) || isTocElement(leaf)
      ? 'text'
      : null
  return kind
    ? { x: leaf.position.x, y: leaf.position.y, width: leaf.size.width, height: leaf.size.height, kind }
    : null
}

export function buildAiTextFitContext(canvas: CanvasData, elementId: string): AiTextFitContext {
  const obstacles = flattenTree(canvas.elements)
    .filter((leaf) => leaf.id !== elementId)
    .map(obstacleFor)
    .filter((obstacle): obstacle is AiTextObstacle => obstacle !== null)

  return {
    pageBottomLimit: (canvas.pageHeight ?? A4_PAGE_HEIGHT) - PRINT_CROP_MARGIN,
    obstacles,
  }
}

/**
 * Every ai-text block whose REAL text (generated or hand-edited — a block still showing its
 * pre-generation placeholder is skipped) causes an actual print problem: runs into a photo or
 * another text below it, or past the page's crop edge. A text merely taller than the admin's box,
 * with free space underneath, is NOT reported — it prints fine. `canvasDataByPageId` must be the
 * materialized canvas (see materializeCanvasData), so each leaf already carries its text in
 * `previewPlaceholderText` and its customer-adjusted typography.
 */
export function collectAiTextFitProblems(
  pages: JournalPage[],
  canvasDataByPageId: Map<string, CanvasData>,
): AiTextFitProblem[] {
  const problems: AiTextFitProblem[] = []

  for (const page of pages) {
    const canvas = canvasDataByPageId.get(page.id)
    if (!canvas) {
      continue
    }

    const elementIdsWithText = new Set(
      page.placeholderValues
        .filter((value) => value.textValue?.trim())
        .map((value) => value.elementId),
    )

    for (const leaf of flattenTree(canvas.elements)) {
      if (!isAiTextElement(leaf) || !elementIdsWithText.has(leaf.id)) {
        continue
      }
      const fit = analyzeAiTextFit(leaf, leaf.previewPlaceholderText ?? '', buildAiTextFitContext(canvas, leaf.id))
      if (fit.issue) {
        problems.push({ journalPageId: page.id, elementId: leaf.id, issue: fit.issue, excessWords: fit.excessWords })
      }
    }
  }

  return problems
}

/** journalPageId → (elementId → tooltip message), the shape QuestionnaireBook forwards per page. */
export function groupAiTextFitProblemsByPage(problems: AiTextFitProblem[]): Map<string, Map<string, string>> {
  const byPage = new Map<string, Map<string, string>>()
  for (const problem of problems) {
    const messages = byPage.get(problem.journalPageId) ?? new Map<string, string>()
    messages.set(problem.elementId, `${AI_TEXT_FIT_ISSUE_LABELS[problem.issue]} — сократите его`)
    byPage.set(problem.journalPageId, messages)
  }
  return byPage
}
