import type { ListLayoutMode, ListSettings, PageElement, Position, TextPlaceholder } from '../models'
import { isGroupElement, isListRow, isTextElement } from '../models'
import { DEFAULT_LIST_MIN_FONT_SCALE, DEFAULT_LIST_MIN_GAP } from '../models/list.model'
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
 * With `heightMode: 'text'`, those targets only decide each row's place and x: inside each column
 * the rows are re-stacked by their real text height within the column's fixed template area (see
 * flowColumn) — the design around the list never moves.
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
  /** Needed for lists with heightMode 'text' (they keep their fixed places without it). */
  measureTextHeight?: MeasureTextHeight
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

interface ListTarget {
  /** Page coordinates of the filled row's centre. */
  point: Position
  /** Index into the list's columns (see splitColumns) — what a text-height flow works within. */
  column: number
}

/** Where each of the `count` filled rows goes, in reading order. */
function listTargets(list: ListInfo, count: number, foldX: number | null, columns: number[][]): ListTarget[] {
  const anchors = list.rows.map((row) => row.anchor)
  const columnOf = new Map(columns.flatMap((column, c) => column.map((index) => [index, c] as const)))
  const onPlaces = (indices: number[]): ListTarget[] =>
    indices.map((index) => ({ point: anchors[index], column: columnOf.get(index) ?? 0 }))

  const manual = manualListSlots(list, count)
  if (manual) {
    return onPlaces(manual)
  }
  if (list.settings.mode === 'path') {
    const counts = allocateItems(columns.map((column) => column.length), count)
    return columns.flatMap((column, c) =>
      pointsAlongPath(column.map((i) => anchors[i]), counts[c]).map((point) => ({ point, column: c })),
    )
  }
  return onPlaces(autoListSlots(list, count, foldX))
}

/** Measures a text's height at a given font size, wrapped to its own box width — injected so this
 * file stays free of Konva (materializeCanvasData passes the editor's own text measurement). */
export type MeasureTextHeight = (text: TextPlaceholder, content: string, fontSize: number) => number

/** Sub-pixel slack when deciding that one element sits below another inside a row. */
const STACK_TOLERANCE = 1

interface RowLayout {
  /** Where the content starts below the node's own `position` (its local frame). */
  top: number
  height: number
  /** How far down each element inside must move (by id, any depth) so nothing overlaps a text
   * that grew — e.g. a description under a title that wrapped onto a second line. */
  shifts: Map<string, number>
  /** For a text: its measured height, the height of one line of it at its template size (what an
   * element tucked inside its box, under its first line, is measured against) and how much its font
   * was shrunk — the gap below it shrinks with it. */
  text?: { height: number; lineHeight: number; scale: number }
}

/**
 * A row's real content, in its own local frame: texts at their measured height (never less than
 * their box), the rest at their size. Inside a group, an element that sits below a text which grew
 * moves down by exactly that growth — so the template's gap between a title and its description is
 * kept, never eaten. A text shorter than its box doesn't pull anything up (the designer's spacing).
 */
function rowLayout(
  node: PageElement,
  measure: MeasureTextHeight,
  fontSizeOf: (text: TextPlaceholder) => number,
): RowLayout {
  if (isTextElement(node)) {
    const fontSize = fontSizeOf(node)
    const textHeight = measure(node, node.defaultText ?? '', fontSize)
    const scale = node.fontSize > 0 ? fontSize / node.fontSize : 1
    return {
      top: 0,
      // A shrunk text's box shrinks with it — else the box would hold the gap below it open.
      height: Math.max(node.size.height * scale, textHeight),
      shifts: new Map(),
      text: { height: textHeight, lineHeight: measure(node, 'Ag', node.fontSize), scale },
    }
  }
  if (!isGroupElement(node) || node.children.length === 0) {
    return { top: 0, height: node.size.height, shifts: new Map() }
  }

  const shifts = new Map<string, number>()
  const placed: Array<{
    top: number
    left: number
    right: number
    templateBottom: number
    bottom: number
    push: number
    text?: RowLayout['text']
  }> = []
  const byTop = [...node.children].sort((a, b) => a.position.y - b.position.y)
  for (const child of byTop) {
    const inner = rowLayout(child, measure, fontSizeOf)
    inner.shifts.forEach((value, id) => shifts.set(id, value))
    const left = child.position.x
    const right = child.position.x + child.size.width
    // Placed below everything that starts above it and overlaps it horizontally, keeping the gap the
    // template had between them — measured from the box's bottom when the child sits below the box,
    // from the first line when it's tucked inside the box (a title box taller than its one line, the
    // description right under that line), so an unchanged one-line text moves nothing. When the text
    // above was shrunk, that gap shrinks by the same factor — the only case that may pull up.
    const aboves = placed.filter(
      (above) => above.top + STACK_TOLERANCE < child.position.y && above.left < right && left < above.right,
    )
    const candidates = aboves.map((above) => {
      const scale = above.text?.scale ?? 1
      const tucked = child.position.y < above.templateBottom - STACK_TOLERANCE
      const gap = tucked && above.text
        ? child.position.y - (above.top + above.text.lineHeight)
        : child.position.y - above.templateBottom
      const contentBottom = tucked && above.text ? above.top + above.text.height : above.bottom
      return contentBottom + above.push + gap * scale - child.position.y
    })
    const shrunkAbove = aboves.some((above) => (above.text?.scale ?? 1) < 1)
    const push = candidates.length === 0 ? 0 : shrunkAbove ? Math.max(...candidates) : Math.max(0, ...candidates)
    if (Math.abs(push) > 1e-9) {
      shifts.set(child.id, push)
    }
    placed.push({
      top: child.position.y,
      left,
      right,
      templateBottom: child.position.y + child.size.height,
      bottom: child.position.y + inner.top + inner.height,
      push,
      text: inner.text,
    })
  }

  const boxes = byTop.map((child, i) => ({
    top: child.position.y + placed[i].push,
    bottom: placed[i].bottom + placed[i].push,
  }))
  const top = Math.min(...boxes.map((box) => box.top))
  return { top, height: Math.max(...boxes.map((box) => box.bottom)) - top, shifts }
}

const FONT_SCALE_STEP = 0.05

interface FlowPlace {
  /** The row's new centre y, in page coordinates. */
  y: number
  fontSizes: Map<string, number>
  /** Elements inside the row moved down so they don't overlap a text that grew (see rowLayout). */
  shifts: Map<string, number>
}

/**
 * heightMode 'text' for one column: the column's template area (top of its first row to bottom of
 * its last) stays where the designer put it, and the filled rows assigned to it are re-stacked
 * inside by their real height — x kept from their targets. Gaps follow `flowAlign`; when even
 * `minGap` gaps don't fit, the descriptions' font shrinks in steps down to `minFontScale`, then —
 * still too tall — the titles' too (no descriptions — the titles straight away); past that the rows
 * run out of the area (the review step's fit check then flags what they run into). Returns each
 * row's new centre y, font sizes and inner shifts to apply.
 */
function flowColumn(
  list: ListInfo,
  columnRows: number[],
  assigned: Array<{ index: number; target: ListTarget }>,
  measure: MeasureTextHeight,
): Map<number, FlowPlace> {
  const placed = new Map<number, FlowPlace>()
  const templateRows = columnRows.map((index) => list.rows[index])
  const boxOf = (row: ListRowInfo) => ({
    top: row.anchor.y - row.node.size.height / 2,
    bottom: row.anchor.y + row.node.size.height / 2,
  })
  const areaTop = Math.min(...templateRows.map((row) => boxOf(row).top))
  const areaBottom = Math.max(...templateRows.map((row) => boxOf(row).bottom))
  const xs = templateRows.map((row) => row.anchor.x)
  // A horizontal run of rows has no column height to fill — it keeps its places.
  if (assigned.length === 0 || Math.max(...xs) - Math.min(...xs) > areaBottom - areaTop) {
    return placed
  }

  const settings = list.settings
  const minGap = settings.minGap ?? DEFAULT_LIST_MIN_GAP
  const minScale = Math.min(1, Math.max(0.5, settings.minFontScale ?? DEFAULT_LIST_MIN_FONT_SCALE))
  const hasDetails = list.rows.some((row) => collectRoleLeaves(row.node, 'detail').length > 0)
  const areaHeight = areaBottom - areaTop
  const templateHeights = templateRows.reduce((sum, row) => sum + row.node.size.height, 0)
  const templateGap =
    templateRows.length > 1 ? Math.max(minGap, (areaHeight - templateHeights) / (templateRows.length - 1)) : minGap

  // Font scale per role: descriptions give way first, titles only once descriptions are at the limit.
  const scales = { detail: 1, item: 1 }
  const scaleOf = (text: TextPlaceholder): number =>
    text.listRole === 'detail' ? scales.detail : text.listRole === 'item' ? scales.item : 1
  const measureAll = () =>
    assigned.map(({ index }) => rowLayout(list.rows[index].node, measure, (text) => text.fontSize * scaleOf(text)))
  const gapsCount = assigned.length - 1
  let contents = measureAll()
  const total = () => contents.reduce((sum, content) => sum + content.height, 0)
  const tooTall = () => total() + minGap * gapsCount > areaHeight
  for (const role of hasDetails ? (['detail', 'item'] as const) : (['item'] as const)) {
    while (tooTall() && scales[role] - FONT_SCALE_STEP >= minScale - 1e-9) {
      const before = { scale: scales[role], contents, height: total() }
      scales[role] = Math.round((scales[role] - FONT_SCALE_STEP) * 100) / 100
      contents = measureAll()
      // A step that doesn't make the rows shorter (one-line titles already fill their boxes) only
      // makes the text smaller for nothing — undo it and leave this role be.
      if (total() >= before.height - 1e-6) {
        scales[role] = before.scale
        contents = before.contents
        break
      }
    }
  }

  const free = areaHeight - total()
  const align = settings.flowAlign ?? 'spread'
  const gap =
    align === 'spread' && gapsCount > 0
      ? Math.max(minGap, free / gapsCount)
      : Math.max(minGap, Math.min(templateGap, gapsCount > 0 ? free / gapsCount : templateGap))
  const blockHeight = total() + gap * gapsCount
  let cursor = align === 'center' ? areaTop + Math.max(0, (areaHeight - blockHeight) / 2) : areaTop

  // Stacked top to bottom on the page — a bottom-up list fills from the bottom, so reverse it.
  const first = templateRows[0].anchor.y
  const last = templateRows[templateRows.length - 1].anchor.y
  const visual = assigned.map((entry, i) => ({ ...entry, content: contents[i] }))
  if (first > last) {
    visual.reverse()
  }
  for (const { index, content } of visual) {
    const row = list.rows[index]
    const fontSizes = new Map<string, number>()
    for (const role of ['detail', 'item'] as const) {
      if (scales[role] >= 1) {
        continue
      }
      for (const id of collectRoleLeaves(row.node, role)) {
        const text = findText(row.node, id)
        if (text) {
          fontSizes.set(id, Math.round(text.fontSize * scales[role] * 10) / 10)
        }
      }
    }
    // The row's box top sits `content.top` above where its content starts.
    placed.set(index, { y: cursor - content.top + row.node.size.height / 2, fontSizes, shifts: content.shifts })
    cursor += content.height + gap
  }
  return placed
}

function findText(node: PageElement, id: string): TextPlaceholder | null {
  if (isTextElement(node)) {
    return node.id === id ? node : null
  }
  return isGroupElement(node) ? (node.children.map((child) => findText(child, id)).find(Boolean) ?? null) : null
}

/** The whole subtree, not just the row itself — flattenTree-based renders (thumbnails, print
 * checks) look at each leaf's own `visible`, never an ancestor's. */
function hide(node: PageElement): PageElement {
  return isGroupElement(node)
    ? { ...node, visible: false, children: node.children.map(hide) }
    : { ...node, visible: false }
}

/** Inside a placed row: number texts get `number`; with a text-height flow, texts get their shrunk
 * `fontSizes` and elements their downward `shifts` (see rowLayout). The row node itself is moved by
 * the caller. */
function patchRowInside(
  node: PageElement,
  numberIds: Set<string>,
  number: string,
  fontSizes: Map<string, number>,
  shifts: Map<string, number>,
): PageElement {
  const children = isGroupElement(node)
    ? node.children.map((child) => {
        const patched = patchRowInside(child, numberIds, number, fontSizes, shifts)
        const shift = shifts.get(child.id)
        return shift ? { ...patched, position: { ...patched.position, y: patched.position.y + shift } } : patched
      })
    : null
  if (isTextElement(node)) {
    const fontSize = fontSizes.get(node.id)
    return numberIds.has(node.id) || fontSize !== undefined
      ? {
          ...node,
          ...(numberIds.has(node.id) && { defaultText: number }),
          ...(fontSize !== undefined && { fontSize }),
        }
      : node
  }
  return isGroupElement(node) && children ? { ...node, children } : node
}

/** A page-space offset expressed in a frame's own (possibly rotated) axes. */
function toFrameVector(dx: number, dy: number, frame: AbsoluteBox): Position {
  const rad = (-frame.rotationDeg * Math.PI) / 180
  return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) }
}

type RowChange =
  | { hide: true }
  | {
      hide: false
      dx: number
      dy: number
      number: string
      fontSizes: Map<string, number>
      shifts: Map<string, number>
    }

function planList(
  list: ListInfo,
  foldX: number | null,
  isItemFilled: (id: string) => boolean,
  measure: MeasureTextHeight | undefined,
): Map<string, RowChange> {
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

  const columns = splitColumns(list.rows, foldX)
  const targets = listTargets(list, filledCount, foldX, columns)
  const assigned: Array<{ index: number; target: ListTarget }> = []
  list.rows.forEach((_, index) => {
    if (filled[index]) {
      assigned.push({ index, target: targets[assigned.length] })
    }
  })

  // heightMode 'text': each column re-stacks its rows by real height (y only, x from the target).
  const flowed = new Map<number, FlowPlace>()
  if (list.settings.heightMode === 'text' && measure) {
    columns.forEach((columnRows, c) => {
      const inColumn = assigned.filter((entry) => entry.target.column === c)
      for (const [index, place] of flowColumn(list, columnRows, inColumn, measure)) {
        flowed.set(index, place)
      }
    })
  }

  list.rows.forEach((row, index) => {
    if (!filled[index]) {
      changes.set(row.node.id, { hide: true })
    }
  })
  assigned.forEach(({ index, target }, order) => {
    const row = list.rows[index]
    const flow = flowed.get(index)
    const y = flow?.y ?? target.point.y
    const local = toFrameVector(target.point.x - row.anchor.x, y - row.anchor.y, row.parentFrame)
    changes.set(row.node.id, {
      hide: false,
      dx: local.x,
      dy: local.y,
      number: String(order + 1),
      fontSizes: flow?.fontSizes ?? new Map(),
      // Even on fixed places, nothing inside a row may overlap a text that grew (see rowLayout).
      shifts: flow?.shifts ?? (measure ? rowLayout(row.node, measure, (text) => text.fontSize).shifts : new Map()),
    })
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
    for (const [rowId, change] of planList(list, foldX, options.isItemFilled, options.measureTextHeight)) {
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
        const numbered = patchRowInside(
          node,
          new Set(collectRoleLeaves(node, 'number')),
          change.number,
          change.fontSizes,
          change.shifts,
        )
        return { ...numbered, position: { x: node.position.x + change.dx, y: node.position.y + change.dy } }
      }
      return isGroupElement(node) ? { ...node, children: apply(node.children) } : node
    })
  }

  return apply(elements)
}
