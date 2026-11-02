import type { ListLayoutMode, ListSettings, PageElement, Position } from '../models'
import { isGroupElement, isListRow, isTextElement } from '../models'
import { ROOT_FRAME, childBoxFromLocal, contentFrameOf, type AbsoluteBox } from './element-tree.util'
import { isSpreadCanvas } from './spread.util'

/**
 * Auto-distributed lists. A list has no container: its rows are ordinary page elements (a small
 * group "number + text", or a single text), anywhere in the tree, sharing a `listId` and read in
 * `listOrder` (see list.model.ts). A row's 'item' text gets one item of the list's LIST answer (the
 * backend's syncAnswersToPlaceholders, one item per row in reading order); its 'number' text shows
 * the row's position among the filled rows.
 *
 * With k of N rows filled, the k filled rows are moved onto k target places and the rest hidden.
 * The targets follow the list's `mode` (see ListLayoutMode) — by default k of the template's own
 * row places, evenly picked, so rows only ever land where the admin drew one — unless the admin
 * picked the places for exactly this k by hand (`slotsByCount`).
 *
 * Automatic modes work per column: the rows split into columns wherever a row sets
 * `listColumnBreak` or the next row sits on the other half of a spread, and items are shared out
 * between columns in proportion to their row counts — so nothing lands in the gap or on the fold.
 *
 * A list with nothing filled stays exactly as designed (placeholders showing), like any unfilled
 * element.
 */

export interface DistributeListsOptions {
  /** Whether a row's 'item' text holds real content (an answer or a hand-written text) — the
   * template's own placeholder text doesn't count. */
  isItemFilled: (elementId: string) => boolean
  pageWidth: number
  pageHeight: number
}

/** One row of a list, as found in the tree. */
export interface ListRowInfo {
  node: PageElement & { listId: string; listOrder: number; list: ListSettings }
  /** The frame the row's own `position` is relative to (its parent's content frame). */
  parentFrame: AbsoluteBox
  /** The row's centre, in page coordinates. */
  anchor: Position
}

export interface ListInfo {
  listId: string
  /** The first row's — authoritative for the whole list. */
  settings: ListSettings
  /** In reading order. */
  rows: ListRowInfo[]
}

function localCentre(row: PageElement): Position {
  return { x: row.position.x + row.size.width / 2, y: row.position.y + row.size.height / 2 }
}

/** Every list in `elements`, rows in reading order, lists in the order their first row appears. */
export function collectLists(elements: PageElement[]): ListInfo[] {
  const byId = new Map<string, ListRowInfo[]>()

  function walk(nodes: PageElement[], parentFrame: AbsoluteBox): void {
    for (const node of nodes) {
      if (isListRow(node)) {
        const anchor = childBoxFromLocal({ position: localCentre(node), rotation: 0 }, parentFrame)
        const rows = byId.get(node.listId) ?? []
        rows.push({ node, parentFrame, anchor: { x: anchor.x, y: anchor.y } })
        byId.set(node.listId, rows)
        continue
      }
      if (isGroupElement(node)) {
        walk(node.children, contentFrameOf(childBoxFromLocal(node, parentFrame), node.size))
      }
    }
  }

  walk(elements, ROOT_FRAME)
  return [...byId].map(([listId, rows]) => {
    const sorted = [...rows].sort((a, b) => a.node.listOrder - b.node.listOrder)
    return { listId, settings: sorted[0].node.list, rows: sorted }
  })
}

export function collectRoleLeaves(row: PageElement, role: 'number' | 'item' | 'detail'): string[] {
  if (isTextElement(row)) {
    return row.listRole === role ? [row.id] : []
  }
  return isGroupElement(row) ? row.children.flatMap((child) => collectRoleLeaves(child, role)) : []
}

/** A row's texts that take content from the answer — its title ('item') and description ('detail'). */
export function collectAnswerLeaves(row: PageElement): string[] {
  return [...collectRoleLeaves(row, 'item'), ...collectRoleLeaves(row, 'detail')]
}

export type ListAnswerField = 'title' | 'text'

/**
 * Which entry and field of a LIST answer each text bound to `questionKey` shows on this page: the
 * question's list rows take entries one each, in reading order — the 'item' text the title, the
 * 'detail' text the description. Mirrors the backend's listAnswerSlots (list-order.util.ts).
 */
export function listAnswerSlots(
  elements: PageElement[],
  questionKey: string,
): Map<string, { entry: number; field: ListAnswerField }> {
  const slots = new Map<string, { entry: number; field: ListAnswerField }>()
  let entry = 0
  for (const list of collectLists(elements)) {
    for (const row of list.rows) {
      const bound = (isGroupElement(row.node) ? flattenTexts(row.node) : isTextElement(row.node) ? [row.node] : []).filter(
        (text) => (text.listRole === 'item' || text.listRole === 'detail') && text.questionKey === questionKey,
      )
      if (bound.length === 0) {
        continue
      }
      for (const text of bound) {
        slots.set(text.id, { entry, field: text.listRole === 'detail' ? 'text' : 'title' })
      }
      entry += 1
    }
  }
  return slots
}

function flattenTexts(node: PageElement): Extract<PageElement, { listRole?: unknown }>[] {
  if (isTextElement(node)) {
    return [node]
  }
  return isGroupElement(node) ? node.children.flatMap(flattenTexts) : []
}

function distance(a: Position, b: Position): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** `count` points evenly spaced by arc length along the polyline through `anchors`, from its first
 * point to its last — the anchors themselves when `count` equals their number. */
export function pointsAlongPath(anchors: Position[], count: number): Position[] {
  if (count <= 0 || anchors.length === 0) {
    return []
  }
  if (count === anchors.length) {
    return anchors.map((anchor) => ({ ...anchor }))
  }
  if (count === 1 || anchors.length === 1) {
    return Array.from({ length: count }, () => ({ ...anchors[0] }))
  }

  const segments = anchors.slice(1).map((anchor, index) => distance(anchors[index], anchor))
  const total = segments.reduce((sum, length) => sum + length, 0)
  if (total === 0) {
    return Array.from({ length: count }, () => ({ ...anchors[0] }))
  }

  const points: Position[] = []
  for (let i = 0; i < count; i += 1) {
    let remaining = (total * i) / (count - 1)
    let segment = 0
    while (segment < segments.length - 1 && remaining > segments[segment]) {
      remaining -= segments[segment]
      segment += 1
    }
    const from = anchors[segment]
    const to = anchors[segment + 1]
    const t = segments[segment] === 0 ? 0 : Math.min(remaining / segments[segment], 1)
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return points
}

/** Which `count` of `total` places (indices, ascending) a place-based mode uses. */
export function pickSlotIndices(total: number, count: number, mode: Exclude<ListLayoutMode, 'path'>): number[] {
  const n = Math.min(Math.max(count, 0), total)
  if (n === 0) {
    return []
  }
  if (mode === 'start') {
    return Array.from({ length: n }, (_, i) => i)
  }
  if (mode === 'center') {
    const first = Math.floor((total - n) / 2)
    return Array.from({ length: n }, (_, i) => first + i)
  }
  // Evenly spaced first-to-last; the step is ≥ 1 (n ≤ total), so rounding never repeats an index.
  return n === 1 ? [0] : Array.from({ length: n }, (_, i) => Math.round((i * (total - 1)) / (n - 1)))
}

/** Shares `total` (≤ the rows overall) items out between columns in proportion to their row counts
 * — largest remainder, ties to the earlier column. A column never gets more items than rows: its
 * quota is at most its row count, and only a fractional quota earns the extra one. */
export function allocateItems(rowCounts: number[], total: number): number[] {
  const rows = rowCounts.reduce((sum, count) => sum + count, 0)
  if (rows === 0) {
    return rowCounts.map(() => 0)
  }

  const quotas = rowCounts.map((count) => (total * count) / rows)
  const allocated = quotas.map(Math.floor)
  const left = total - allocated.reduce((sum, count) => sum + count, 0)
  quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, left)
    .forEach(({ index }) => {
      allocated[index] += 1
    })
  return allocated
}

/** Row indices grouped into columns — see the file comment. */
function splitColumns(rows: ListRowInfo[], foldX: number | null): number[][] {
  const columns: number[][] = []
  let previousSide: boolean | null = null

  rows.forEach((row, index) => {
    const side = foldX === null ? null : row.anchor.x >= foldX
    const startsColumn = index === 0 || row.node.listColumnBreak === true || (side !== null && side !== previousSide)
    if (startsColumn) {
      columns.push([index])
    } else {
      columns[columns.length - 1].push(index)
    }
    previousSide = side
  })
  return columns
}

/** The admin's hand-picked places for `count` items as row indices (ascending), when they're usable
 * as such — row ids are looked up, older index entries taken as they are. */
export function manualListSlots(list: ListInfo, count: number): number[] | null {
  const slots = list.settings.slotsByCount?.[String(count)]
  if (!slots) {
    return null
  }
  const indices = slots.map((slot) =>
    typeof slot === 'number' ? slot : list.rows.findIndex((row) => row.node.id === slot),
  )
  const usable =
    indices.length === count &&
    new Set(indices).size === count &&
    indices.every((index) => Number.isInteger(index) && index >= 0 && index < list.rows.length)
  return usable ? indices.sort((a, b) => a - b) : null
}

/** The row indices the automatic place-based modes use for `count` items (path mode borrows the
 * 'slots' pick) — what the editor pre-checks when the admin starts a manual layout. */
export function autoListSlots(list: ListInfo, count: number, foldX: number | null): number[] {
  const mode = list.settings.mode === undefined || list.settings.mode === 'path' ? 'slots' : list.settings.mode
  const columns = splitColumns(list.rows, foldX)
  const counts = allocateItems(columns.map((column) => column.length), count)
  return columns.flatMap((column, index) => pickSlotIndices(column.length, counts[index], mode).map((i) => column[i]))
}

/** Where each of the `count` filled rows goes (page coordinates), in reading order. */
function listTargets(list: ListInfo, count: number, foldX: number | null): Position[] {
  const anchors = list.rows.map((row) => row.anchor)
  const manual = manualListSlots(list, count)
  if (manual) {
    return manual.map((index) => anchors[index])
  }
  if (list.settings.mode === 'path') {
    const columns = splitColumns(list.rows, foldX)
    const counts = allocateItems(columns.map((column) => column.length), count)
    return columns.flatMap((column, index) => pointsAlongPath(column.map((i) => anchors[i]), counts[index]))
  }
  return autoListSlots(list, count, foldX).map((index) => anchors[index])
}

/** The whole subtree, not just the row itself — flattenTree-based renders (thumbnails, print
 * checks) look at each leaf's own `visible`, never an ancestor's. */
function hide(node: PageElement): PageElement {
  return isGroupElement(node)
    ? { ...node, visible: false, children: node.children.map(hide) }
    : { ...node, visible: false }
}

function setNumber(node: PageElement, numberIds: Set<string>, value: string): PageElement {
  if (isTextElement(node)) {
    return numberIds.has(node.id) ? { ...node, defaultText: value } : node
  }
  if (isGroupElement(node)) {
    return { ...node, children: node.children.map((child) => setNumber(child, numberIds, value)) }
  }
  return node
}

/** A page-space offset expressed in a frame's own (possibly rotated) axes. */
function toFrameVector(dx: number, dy: number, frame: AbsoluteBox): Position {
  const rad = (-frame.rotationDeg * Math.PI) / 180
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) }
}

type RowChange = { hide: true } | { hide: false; dx: number; dy: number; number: string }

function planList(list: ListInfo, foldX: number | null, isItemFilled: (id: string) => boolean): Map<string, RowChange> {
  const changes = new Map<string, RowChange>()
  // A row without any title/description text (decoration, a header) always counts as filled; one
  // with them counts as filled once either holds something.
  const filled = list.rows.map((row) => {
    const items = collectAnswerLeaves(row.node)
    return items.length === 0 || items.some(isItemFilled)
  })
  const filledCount = filled.filter(Boolean).length
  if (filledCount === 0) {
    return changes
  }

  const targets = listTargets(list, filledCount, foldX)
  let filledIndex = 0
  list.rows.forEach((row, index) => {
    if (!filled[index]) {
      changes.set(row.node.id, { hide: true })
      return
    }
    const target = targets[filledIndex]
    filledIndex += 1
    const local = toFrameVector(target.x - row.anchor.x, target.y - row.anchor.y, row.parentFrame)
    changes.set(row.node.id, { hide: false, dx: local.x, dy: local.y, number: String(filledIndex) })
  })
  return changes
}

/**
 * What's unfinished about the page's lists — warned about when the admin saves the template (the
 * save goes through regardless): a list with no question gets no items; a row with no item text is
 * never filled (it just always shows); a minimum above the row count can't be met; a manual layout
 * that no longer fits its count (rows removed since) is silently ignored.
 */
export function findListProblems(elements: PageElement[]): string[] {
  return collectLists(elements).flatMap((list, index) => {
    const name = `Список ${index + 1}`
    const problems: string[] = []
    if (!list.settings.questionKey) {
      problems.push(`${name}: не выбран вопрос`)
    }
    const withoutItem = list.rows
      .map((row, rowIndex) => (collectAnswerLeaves(row.node).length === 0 ? rowIndex + 1 : null))
      .filter((rowNumber): rowNumber is number => rowNumber !== null)
    if (withoutItem.length > 0) {
      problems.push(`${name}: нет заголовка и описания пункта в ${withoutItem.length > 1 ? 'строках' : 'строке'} ${withoutItem.join(', ')}`)
    }
    if ((list.settings.minItems ?? 0) > list.rows.length) {
      problems.push(`${name}: минимум ${list.settings.minItems} больше числа строк (${list.rows.length})`)
    }
    const staleCounts = Object.keys(list.settings.slotsByCount ?? {})
      .map(Number)
      .filter((count) => count > list.rows.length || !manualListSlots(list, count))
    if (staleCounts.length > 0) {
      problems.push(`${name}: своя раскладка для ${staleCounts.join(', ')} не подходит к строкам — проверьте её`)
    }
    return problems
  })
}

/** The fold's x on a spread canvas, null on a single page — where automatic columns split. */
export function listFoldX(pageWidth: number, pageHeight: number): number | null {
  return isSpreadCanvas(pageWidth, pageHeight) ? pageWidth / 2 : null
}

/** Lays out every list in `elements` for its filled rows — see the file comment. */
export function distributeLists(elements: PageElement[], options: DistributeListsOptions): PageElement[] {
  const lists = collectLists(elements)
  if (lists.length === 0) {
    return elements
  }

  const foldX = listFoldX(options.pageWidth, options.pageHeight)
  const changes = new Map<string, RowChange>()
  for (const list of lists) {
    for (const [rowId, change] of planList(list, foldX, options.isItemFilled)) {
      changes.set(rowId, change)
    }
  }
  if (changes.size === 0) {
    return elements
  }

  function apply(nodes: PageElement[]): PageElement[] {
    return nodes.map((node) => {
      const change = changes.get(node.id)
      if (change?.hide) {
        return hide(node)
      }
      if (change) {
        const numbered = setNumber(node, new Set(collectRoleLeaves(node, 'number')), change.number)
        return { ...numbered, position: { x: node.position.x + change.dx, y: node.position.y + change.dy } }
      }
      return isGroupElement(node) ? { ...node, children: apply(node.children) } : node
    })
  }

  return apply(elements)
}
