import { EDITOR_FONT_BODY } from '../constants/page.constants'
import type { GroupElement, PageElement, TextPlaceholder } from '../models'
import { isGroupElement, isTextElement } from '../models'
import type { ListSettings, TocNumberFormat, TocTitleFit } from '../models/list.model'
import { DEFAULT_LIST_MIN_FONT_SCALE, DEFAULT_LIST_MIN_GAP } from '../models/list.model'
import type { TocEntry } from '../models/toc-placeholder.model'
import { generateElementId } from './element-tree.util'
import { collectLists, collectRoleLeaves } from './list-distribution.util'
import { isSpreadCanvas } from './spread.util'
import {
  groupTemplatesByPageType,
  pickDefaultSpreadTemplate,
  resolveInitialSpreadCount,
  type DefaultSpreadTemplate,
} from '@/features/order-builder/utils/journal-structure.util'

/** Rows a new table of contents places in each column (one column per page of a spread). */
export const TOC_ROWS_PER_COLUMN = 8

const COLUMN_MARGIN_X = 40
const COLUMN_GUTTER = 32
const PAGE_MARGIN_Y = 56
const TITLE_FONT_SIZE = 15
const ROW_HEIGHT = Math.ceil(TITLE_FONT_SIZE * 1.2)
const NUMBER_GAP = 12
const TITLE_SAMPLE = 'Название раздела'
/** First listed section starts on page 3: the cover is not numbered, and the contents spread
 * itself takes pages 1–2. Each following section is one spread, so the next numbers are 5, 7, 9. */
export function tocSamplePageNumber(index: number): number {
  return 3 + index * 2
}
const DETAIL_FONT_SIZE = 12
const DETAIL_GAP = 2
/** Shown in the template while descriptions are on, until a real page description replaces it. */
const DESCRIPTION_SAMPLE = 'Описание раздела'

/**
 * A table of contents is a list (`source: 'toc'`): the admin places the rows, including across
 * both pages of the spread, and uses the same layout, spacing and font controls as any list.
 * The titles and page numbers are not typed — `applyTocEntries` writes them from the journal.
 */
export function createTocListRows(
  pageWidth: number,
  pageHeight: number,
  options?: { showDescription?: boolean },
): GroupElement[] {
  const showDescription = options?.showDescription === true
  const listId = `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const settings: ListSettings = {
    questionKey: null,
    source: 'toc',
    mode: 'slots',
    heightMode: 'text',
    flowAlign: 'spread',
    minGap: DEFAULT_LIST_MIN_GAP,
    minFontScale: DEFAULT_LIST_MIN_FONT_SCALE,
    showDescription,
  }
  const spread = isSpreadCanvas(pageWidth, pageHeight)
  const fold = pageWidth / 2
  const columns = spread
    ? [
        { x: COLUMN_MARGIN_X, break: false },
        { x: fold + COLUMN_GUTTER, break: true },
      ]
    : [{ x: COLUMN_MARGIN_X, break: false }]
  const detailHeight = Math.ceil(DETAIL_FONT_SIZE * 1.3)
  const blockHeight = showDescription ? ROW_HEIGHT + DETAIL_GAP + detailHeight : ROW_HEIGHT
  const step =
    TOC_ROWS_PER_COLUMN > 1 ? (pageHeight - PAGE_MARGIN_Y * 2 - blockHeight) / (TOC_ROWS_PER_COLUMN - 1) : 0

  const rows: GroupElement[] = []
  let order = 0
  for (const column of columns) {
    for (let index = 0; index < TOC_ROWS_PER_COLUMN; index += 1) {
      order += 1
      rows.push(
        tocRow({
          listId,
          settings,
          order: order - 1,
          columnBreak: column.break && index === 0,
          name: `Раздел ${order}`,
          pageNumber: tocSamplePageNumber(order - 1),
          x: column.x,
          y: Math.round(PAGE_MARGIN_Y + step * index),
          showDescription,
          blockHeight,
        }),
      )
    }
  }
  return rows
}

/** Writes journal rows into every toc-list. Extra template rows are left blank so distribution
 * hides them; no sections at all hides the rows. Page numbers stay in the 'number' texts —
 * list distribution does not replace them for `source: 'toc'`. */
export function applyTocEntries(elements: PageElement[], entries: TocEntry[]): PageElement[] {
  const lists = collectLists(elements).filter((list) => list.settings.source === 'toc')
  if (lists.length === 0) {
    return elements
  }

  const textById = new Map<string, string>()
  const hideIds = new Set<string>()
  const showIds = new Set<string>()
  for (const list of lists) {
    if (entries.length === 0) {
      for (const row of list.rows) {
        hideIds.add(row.node.id)
      }
      continue
    }
    list.rows.forEach((row, index) => {
      const entry = entries[index]
      if (entry) {
        showIds.add(row.node.id)
      }
      for (const id of collectRoleLeaves(row.node, 'item')) {
        textById.set(id, entry?.title ?? '')
      }
      for (const id of collectRoleLeaves(row.node, 'number')) {
        textById.set(id, entry ? formatTocPageLabel(entry.pageLabel, list.settings.numberFormat) : '')
      }
      for (const id of collectRoleLeaves(row.node, 'detail')) {
        textById.set(id, entry?.description ?? '')
      }
    })
  }

  function writeTexts(node: PageElement): PageElement {
    if (isTextElement(node) && textById.has(node.id)) {
      return { ...node, defaultText: textById.get(node.id) }
    }
    return isGroupElement(node) ? { ...node, children: node.children.map(writeTexts) } : node
  }

  function walk(nodes: PageElement[]): PageElement[] {
    return nodes.map((node) => {
      if (hideIds.has(node.id)) {
        return setVisible(node, false)
      }
      if (showIds.has(node.id)) {
        return writeTexts(setVisible(node, true))
      }
      if (isTextElement(node) && textById.has(node.id)) {
        return { ...node, defaultText: textById.get(node.id) }
      }
      return isGroupElement(node) ? { ...node, children: walk(node.children) } : node
    })
  }

  return refreshTocRows(walk(elements))
}

/** A real page name and its contents description, used to preview a row in the template. */
export interface TocAdminSample {
  title: string
  description: string
}

export interface TocAdminSamplePage {
  id: string
  name: string
  description?: string | null
  pageType: string
}

/** Default journal sections first, in the order the buyer sees them. Rows beyond that journal
 * take the remaining pages, longest text first, and a page with both a title and a description
 * comes before one that has only one of them. */
export function buildTocAdminSamples(options: {
  pages: TocAdminSamplePage[]
  includedSpreads: number
  defaultSpreads: DefaultSpreadTemplate[]
  rowCount: number
}): TocAdminSample[] {
  const pages = options.pages
  const byId = new Map(pages.map((page) => [page.id, page]))
  const catalog = groupTemplatesByPageType(
    pages.map((page) => ({
      id: page.id,
      name: page.name,
      description: page.description ?? null,
      pageType: page.pageType,
      sortOrder: 0,
      previewImage: null,
      canvasData: null,
      isRequired: false,
    })),
  )
  const spreadCount = resolveInitialSpreadCount(options.includedSpreads, catalog.toc.length > 0)
  const fallback = pickDefaultSpreadTemplate(catalog)
  const configured = options.defaultSpreads
  const defaults: TocAdminSample[] = []
  const used = new Set<string>()
  for (let index = 0; index < spreadCount; index += 1) {
    const config = configured.length > 0 ? (configured[index] ?? configured[configured.length - 1]) : fallback
    if (!config) {
      continue
    }
    const left = byId.get(config.magazinePageId)
    if (left && (left.pageType === 'SPREAD' || left.pageType === 'PAGE')) {
      used.add(left.id)
      defaults.push(sampleOf(left))
    }
    if (config.layoutMode === 'SPLIT_PAGES' && config.rightMagazinePageId) {
      const right = byId.get(config.rightMagazinePageId)
      if (right) {
        used.add(right.id)
        defaults.push(sampleOf(right))
      }
    }
  }

  const content = pages.filter((page) => page.pageType === 'SPREAD' || page.pageType === 'PAGE')
  let pool = content.filter((page) => !used.has(page.id))
  if (pool.length === 0) {
    pool = content
  }
  pool = [...pool].sort((a, b) => sampleRichness(b) - sampleRichness(a))

  const samples = [...defaults]
  let cursor = 0
  while (samples.length < options.rowCount && pool.length > 0 && cursor < options.rowCount) {
    samples.push(sampleOf(pool[cursor % pool.length]))
    cursor += 1
  }
  return samples
}

function sampleOf(page: TocAdminSamplePage): TocAdminSample {
  return {
    title: page.name.trim() || 'Без названия',
    description: page.description?.trim() ?? '',
  }
}

/** Both a title and a description outrank either one alone; within that, the longer text wins. */
function sampleRichness(page: TocAdminSamplePage): number {
  const title = page.name.trim()
  const description = page.description?.trim() ?? ''
  const both = title && description ? 1_000_000 : 0
  return both + title.length + description.length
}

/** Writes preview titles and descriptions onto contents rows. A row past the sample list is left
 * as it is. Returns the same array when every text already matches. */
export function applyTocAdminSamples(elements: PageElement[], samples: TocAdminSample[]): PageElement[] {
  if (samples.length === 0) {
    return elements
  }
  const lists = collectLists(elements).filter((list) => list.settings.source === 'toc')
  const textById = new Map<string, string>()
  for (const list of lists) {
    const rows = [...list.rows].sort((a, b) => (a.node.listOrder ?? 0) - (b.node.listOrder ?? 0))
    rows.forEach((row, index) => {
      const sample = samples[index]
      if (!sample) {
        return
      }
      for (const id of collectRoleLeaves(row.node, 'item')) {
        textById.set(id, sample.title)
      }
      if (list.settings.showDescription === true) {
        for (const id of collectRoleLeaves(row.node, 'detail')) {
          textById.set(id, sample.description)
        }
      }
    })
  }
  if (textById.size === 0) {
    return elements
  }
  let changed = false
  function write(node: PageElement): PageElement {
    if (isTextElement(node) && textById.has(node.id)) {
      const next = textById.get(node.id) ?? ''
      if ((node.defaultText ?? '') === next) {
        return node
      }
      changed = true
      return { ...node, defaultText: next }
    }
    if (!isGroupElement(node)) {
      return node
    }
    const children = node.children.map(write)
    if (children.every((child, index) => child === node.children[index])) {
      return node
    }
    changed = true
    return { ...node, children }
  }
  const next = elements.map(write)
  return changed ? next : elements
}

/** Rewrites the dotted leader (and a sample page number) from each contents row's own settings.
 * Called when the admin toggles those settings, before any journal entries exist. */
export function refreshTocRows(elements: PageElement[]): PageElement[] {
  let changed = false
  function visit(node: PageElement): PageElement {
    if (isGroupElement(node) && node.list?.source === 'toc' && node.listId) {
      const next = finishTocRow(node)
      if (next !== node) {
        changed = true
      }
      return next
    }
    if (!isGroupElement(node)) {
      return node
    }
    const children = node.children.map(visit)
    if (children.every((child, index) => child === node.children[index])) {
      return node
    }
    changed = true
    return { ...node, children }
  }
  const next = elements.map(visit)
  return changed ? next : elements
}

/** Puts the sample line on every contents row that has no description yet, so the admin can see
 * and style it. A real journal replaces this text. */
export function seedTocDescriptionSamples(elements: PageElement[]): PageElement[] {
  let changed = false
  function visit(node: PageElement): PageElement {
    if (isGroupElement(node) && node.list?.source === 'toc' && node.list.showDescription === true) {
      const detail = node.children.find((child) => isTextElement(child) && child.listRole === 'detail')
      if (detail && isTextElement(detail)) {
        if ((detail.defaultText ?? '').trim()) {
          return node
        }
        changed = true
        return {
          ...node,
          children: node.children.map((child) =>
            child.id === detail.id ? { ...detail, defaultText: DESCRIPTION_SAMPLE } : child,
          ),
        }
      }
      changed = true
      return {
        ...node,
        children: [
          ...node.children,
          tocText({
            name: 'Описание',
            role: 'detail',
            text: DESCRIPTION_SAMPLE,
            x: 0,
            y: 0,
            width: node.size.width,
            align: 'left',
          }),
        ],
      }
    }
    if (!isGroupElement(node)) {
      return node
    }
    const children = node.children.map(visit)
    if (children.every((child, index) => child === node.children[index])) {
      return node
    }
    changed = true
    return { ...node, children }
  }
  const next = elements.map(visit)
  return changed ? next : elements
}

/** `3`, `03` or `стр. 3`. A label that is not a plain integer is left as written. */
export function formatTocPageLabel(raw: string, format?: TocNumberFormat): string {
  const match = raw.trim().match(/^(\d+)$/)
  if (!match) {
    return raw
  }
  const digits = match[1]
  if (format === 'pad2') {
    return digits.padStart(2, '0')
  }
  if (format === 'page') {
    return `стр. ${Number(digits)}`
  }
  return String(Number(digits))
}

/** Sample numbers in the template follow the chosen format and keep their own page (`5` stays 5,
 * `стр. 5` stays page 5). A label that is not a page number is left as written. `00` is the
 * unset sample and is filled in by `stampTocSamplePages`. */
function formatSampleNumber(raw: string, format?: TocNumberFormat): string {
  const value = parseTocNumber(raw)
  if (value == null) {
    return raw
  }
  return formatTocPageLabel(String(value), format)
}

/** `3`, `03` and `стр. 3` are page 3. `0` and `00` are the unset sample. Anything else is not a page number. */
function parseTocNumber(raw: string): number | null {
  const trimmed = raw.trim()
  const page = trimmed.match(/^стр\.\s*(\d+)$/)
  const digits = page?.[1] ?? trimmed.match(/^(\d+)$/)?.[1]
  if (!digits || digits === '0' || digits === '00') {
    return null
  }
  return Number(digits)
}

/** Rows still showing the old single sample (`3` on every line, or `00`) get the real sequence
 * 3, 5, 7. A list that already has different numbers is left alone, so a finished journal is not
 * rewritten. Returns the same array when nothing changes. */
export function stampTocSamplePages(elements: PageElement[]): PageElement[] {
  const lists = collectLists(elements).filter((list) => list.settings.source === 'toc')
  const nextById = new Map<string, string>()
  for (const list of lists) {
    const rows = [...list.rows].sort((a, b) => (a.node.listOrder ?? 0) - (b.node.listOrder ?? 0))
    const numbers = rows.map((row) => rowNumber(row.node))
    const values = numbers.map((text) => (text == null ? null : parseTocNumber(text.defaultText ?? '')))
    const assigned = values.filter((value): value is number => value != null)
    if (assigned.length > 0 && assigned.some((value) => value !== 3)) {
      continue
    }
    for (const [index] of rows.entries()) {
      const text = numbers[index]
      if (!text) {
        continue
      }
      const formatted = formatTocPageLabel(String(tocSamplePageNumber(index)), list.settings.numberFormat)
      if ((text.defaultText ?? '') !== formatted) {
        nextById.set(text.id, formatted)
      }
    }
  }
  if (nextById.size === 0) {
    return elements
  }
  function write(node: PageElement): PageElement {
    if (isTextElement(node) && nextById.has(node.id)) {
      return { ...node, defaultText: nextById.get(node.id) }
    }
    return isGroupElement(node) ? { ...node, children: node.children.map(write) } : node
  }
  return elements.map(write)
}

function rowNumber(row: PageElement): TextPlaceholder | null {
  if (!isGroupElement(row)) {
    return null
  }
  const number = row.children.find((child) => isTextElement(child) && child.listRole === 'number')
  return number && isTextElement(number) ? number : null
}

/** A long title either wraps (the box grows) or the font shrinks until the words fit one line. */
function fitTitle(title: TextPlaceholder, fit: TocTitleFit | undefined, minFontScale?: number): TextPlaceholder {
  const text = title.defaultText ?? ''
  const perLine = Math.max(1, Math.floor(title.size.width / (title.fontSize * 0.55)))
  const lineHeight = title.lineHeight || 1.2
  if ((fit ?? 'wrap') === 'shrink') {
    if (text.length <= perLine) {
      return title
    }
    const floor = title.fontSize * (minFontScale ?? 0.7)
    const fontSize = Math.max(floor, Math.round((title.fontSize * perLine) / text.length))
    return fontSize === title.fontSize ? title : { ...title, fontSize }
  }
  const lines = Math.max(1, Math.ceil(text.length / perLine))
  const height = Math.max(title.size.height, Math.ceil(lines * title.fontSize * lineHeight))
  return height === title.size.height ? title : { ...title, size: { ...title.size, height } }
}

function placeDetail(
  title: TextPlaceholder,
  detail: TextPlaceholder | null,
  description: string,
  show: boolean,
): TextPlaceholder | null {
  if (!show || !description) {
    if (!detail || (detail.visible === false && detail.size.height === 0)) {
      return detail
    }
    return { ...detail, visible: false, size: { ...detail.size, height: 0 } }
  }
  const base = detail ?? tocText({
    name: 'Описание',
    role: 'detail',
    text: description,
    x: title.position.x,
    y: title.position.y + title.size.height + DETAIL_GAP,
    width: title.size.width,
    align: 'left',
  })
  const fontSize = base.fontSize || DETAIL_FONT_SIZE
  const perLine = Math.max(1, Math.floor(Math.max(16, title.size.width) / (fontSize * 0.55)))
  const lines = Math.max(1, Math.ceil(description.length / perLine))
  const height = Math.ceil(lines * fontSize * 1.3)
  const titleLine = Math.ceil((title.fontSize || fontSize) * (title.lineHeight || 1.2))
  const titlePerLine = Math.max(1, Math.floor(Math.max(16, title.size.width) / ((title.fontSize || fontSize) * 0.55)))
  const titleLines = Math.max(1, Math.ceil((title.defaultText ?? '').length / titlePerLine))
  const underTitle = title.position.y + Math.min(title.size.height, titleLines * titleLine)
  // Leave the height alone in this pass. Rewriting it from the character-count guess on every
  // refresh snapped the row and started another pass. tightenTocRows then sets the height from
  // the measured text, so the empty space under the last line does not stay.
  if (detail && detail.visible !== false && detail.size.height > 0) {
    if (detail.visible === true && detail.defaultText === description) {
      return detail
    }
    return { ...detail, defaultText: description, visible: true }
  }
  const next: TextPlaceholder = {
    ...base,
    defaultText: description,
    visible: true,
    position: { x: title.position.x, y: underTitle + DETAIL_GAP },
    size: { width: title.size.width, height },
  }
  if (
    detail &&
    detail.visible === true &&
    detail.defaultText === description &&
    Math.abs(detail.position.x - next.position.x) < 1 &&
    Math.abs(detail.position.y - next.position.y) < 1 &&
    Math.abs(detail.size.width - next.size.width) < 1 &&
    Math.abs(detail.size.height - next.size.height) < 1
  ) {
    return detail
  }
  return next
}

/** The description line and a long title, from the row's own settings and current texts. */
function finishTocRow(row: GroupElement): GroupElement {
  const settings = row.list
  let children = row.children.map((child) => {
    if (!isTextElement(child) || child.listRole !== 'number') {
      return child
    }
    const next = formatSampleNumber(child.defaultText ?? '', settings?.numberFormat)
    return next === child.defaultText ? child : { ...child, defaultText: next }
  })

  const title = children.find((child) => isTextElement(child) && child.listRole === 'item')
  if (title && isTextElement(title)) {
    const fitted = fitTitle(title, settings?.titleFit, settings?.minFontScale)
    children = children.map((child) => (child.id === title.id ? fitted : child))
  }

  const titleNow = children.find((child) => isTextElement(child) && child.listRole === 'item')
  const detail = children.find((child) => isTextElement(child) && child.listRole === 'detail')
  if (titleNow && isTextElement(titleNow)) {
    const description = detail && isTextElement(detail) ? (detail.defaultText ?? '').trim() : ''
    const placed = placeDetail(
      titleNow,
      detail && isTextElement(detail) ? detail : null,
      description,
      settings?.showDescription === true,
    )
    if (placed) {
      children = detail
        ? children.map((child) => (child.id === placed.id ? placed : child))
        : [...children, placed]
    }
  }

  if (children.some((child) => child.name === 'Отточие')) {
    children = children.filter((child) => child.name !== 'Отточие')
  }

  const visibleChildren = children.filter((child) => child.visible !== false)
  const bottom = visibleChildren.length
    ? Math.max(...visibleChildren.map((child) => child.position.y + child.size.height))
    : row.size.height
  // Only grow. Shrinking here, then letting the canvas repair pass measure the row again,
  // moved every following row on each frame and the page locked up.
  const height = Math.max(row.size.height, Math.ceil(bottom))
  const width = row.size.width
  if (
    height === row.size.height &&
    width === row.size.width &&
    children.length === row.children.length &&
    children.every((child, index) => child === row.children[index])
  ) {
    return row
  }
  return { ...row, size: { ...row.size, width, height }, children }
}

/** Item texts of a toc-list that `applyTocEntries` actually filled — what makes that row count
 * as filled for distribution. */
export function tocFilledItemIds(elements: PageElement[]): Set<string> {
  const ids = new Set<string>()
  for (const list of collectLists(elements)) {
    if (list.settings.source !== 'toc') {
      continue
    }
    for (const row of list.rows) {
      for (const id of collectRoleLeaves(row.node, 'item')) {
        const text = findText(row.node, id)
        if (text?.defaultText?.trim()) {
          ids.add(id)
        }
      }
    }
  }
  return ids
}

export interface TocTextMeasure {
  width: number
  height: number
}

/** Glyph box of one contents text. Width is the longest line, height is one line (or the wrap). */
export type MeasureTocText = (text: TextPlaceholder) => TocTextMeasure

/**
 * The selection frame is the group box. A contents row that was stretched (or built as a full
 * column) keeps its words in the top-left and leaves the rest of the frame empty. Shrink that
 * frame back to the words. A page number that still sits on the right edge moves with the title;
 * one that was dragged elsewhere stays where it is.
 *
 * Rows that are already a single line are left alone, so a width the admin set with the side
 * handles survives the next open. `hug` fits every row — used for a list that was just created.
 */
export function tightenTocRows(
  elements: PageElement[],
  measure: MeasureTocText,
  options?: { hug?: boolean },
): PageElement[] {
  let changed = false

  function visit(node: PageElement): PageElement {
    if (isGroupElement(node) && node.list?.source === 'toc') {
      const fitted = tightenTocRow(node, measure, options?.hug === true)
      if (fitted !== node) {
        changed = true
      }
      return fitted
    }
    if (!isGroupElement(node)) {
      return node
    }
    const children = visitList(node.children)
    if (children === node.children) {
      return node
    }
    changed = true
    return { ...node, children }
  }

  function visitList(nodes: PageElement[]): PageElement[] {
    let next: PageElement[] | null = null
    nodes.forEach((node, index) => {
      const replacement = visit(node)
      if (replacement !== node) {
        if (!next) {
          next = nodes.slice()
        }
        next[index] = replacement
      }
    })
    return next ?? nodes
  }

  const result = visitList(elements)
  return changed ? result : elements
}

function tightenTocRow(row: GroupElement, measure: MeasureTocText, hug: boolean): GroupElement {
  const texts = row.children.filter(isTextElement)
  if (texts.length === 0) {
    return row
  }

  const framed = texts.filter((text) => text.listRole !== 'detail')
  const measured = new Map(texts.map((text) => [text.id, measure(text)]))
  // The description height is a character-count guess, then it is frozen. The author has no
  // height handle, and vertical centering leaves empty space under the last line. The box is
  // the measured text; the width the author set with the side handles stays.
  const hugged = row.children.map((child) => hugDetailHeight(child, measured))
  const detailChanged = hugged.some((child, index) => child !== row.children[index])
  const line =
    framed.length > 0
      ? Math.max(...framed.map((text) => measured.get(text.id)?.height ?? 0))
      : 0
  const childrenBottom = Math.max(...row.children.map((child) => child.position.y + child.size.height))
  const frameTallerThanWords =
    line > 0 && (row.size.height > line * 2 || framed.some((text) => text.size.height > line * 2))
  const frameTallerThanChildren = row.size.height > childrenBottom + 2

  if (!hug && !frameTallerThanWords && !frameTallerThanChildren && !detailChanged) {
    return row
  }

  const number = texts.find((text) => text.listRole === 'number')
  const numberOnRight =
    number != null && Math.abs(number.position.x + number.size.width - row.size.width) <= 8
  // A number still on the right edge means the row is the whole line up to that number.
  // A number that was moved off that edge leaves the rest of the box empty — drop that empty width.
  const hugWidth = hug || ((frameTallerThanWords || frameTallerThanChildren) && !numberOnRight)

  let children = hugged.map((child) => {
    if (!isTextElement(child) || child.listRole === 'detail') {
      return child
    }
    const box = measured.get(child.id)
    if (!box) {
      return child
    }
    const hugThisText = hugWidth
    const width = hugThisText && child.size.width > box.width + 8 ? box.width : child.size.width
    const height = hugThisText ? box.height : Math.min(child.size.height, box.height)
    // Words sit in the middle of a tall box. Keep them on the page and let the frame follow.
    const shrink = child.size.height - height
    const dy =
      shrink > 1 && child.verticalAlign === 'middle'
        ? shrink / 2
        : shrink > 1 && child.verticalAlign === 'bottom'
          ? shrink
          : 0
    if (width === child.size.width && height === child.size.height && dy === 0) {
      return child
    }
    return {
      ...child,
      position: { x: child.position.x, y: child.position.y + dy },
      size: { width, height },
    }
  })

  if (numberOnRight && hug) {
    const title = children.find((child) => isTextElement(child) && child.listRole === 'item')
    if (title && isTextElement(title)) {
      const x = title.position.x + title.size.width + NUMBER_GAP
      children = children.map((child) =>
        isTextElement(child) && child.listRole === 'number'
          ? { ...child, position: { ...child.position, x } }
          : child,
      )
    }
  }

  return fitGroupToChildren(row, children)
}

function hugDetailHeight(
  child: PageElement,
  measured: Map<string, TocTextMeasure>,
): PageElement {
  if (!isTextElement(child) || child.listRole !== 'detail' || child.visible === false) {
    return child
  }
  const box = measured.get(child.id)
  if (!box || box.height <= 0) {
    return child
  }
  const height = Math.max(1, Math.ceil(box.height))
  if (Math.abs(child.size.height - height) < 1) {
    return child
  }
  return { ...child, size: { ...child.size, height } }
}

function fitGroupToChildren(row: GroupElement, children: PageElement[]): GroupElement {
  const bounds = children.some((child) => child.visible !== false)
    ? children.filter((child) => child.visible !== false)
    : children
  const minX = Math.min(...bounds.map((child) => child.position.x))
  const minY = Math.min(...bounds.map((child) => child.position.y))
  const shifted = children.map((child) => {
    const x = child.position.x - minX
    const y = child.position.y - minY
    if (x === child.position.x && y === child.position.y) {
      return child
    }
    return { ...child, position: { x, y } }
  })
  const width = Math.max(16, Math.ceil(Math.max(...bounds.map((child) => child.position.x + child.size.width)) - minX))
  const height = Math.max(8, Math.ceil(Math.max(...bounds.map((child) => child.position.y + child.size.height)) - minY))
  const nextX = Math.round(row.position.x + minX)
  const nextY = Math.round(row.position.y + minY)
  if (
    nextX === row.position.x &&
    nextY === row.position.y &&
    width === row.size.width &&
    height === row.size.height &&
    shifted.every((child, index) => child === row.children[index])
  ) {
    return row
  }
  return {
    ...row,
    position: { x: nextX, y: nextY },
    size: { width, height },
    children: shifted,
  }
}

/** Rough glyph width so a new row's frame hugs the sample words before real font metrics run. */
function estimatedTextWidth(text: string): number {
  return Math.max(16, Math.ceil(text.length * TITLE_FONT_SIZE * 0.62))
}

function tocRow(options: {
  listId: string
  settings: ListSettings
  order: number
  columnBreak: boolean
  name: string
  pageNumber: number
  x: number
  y: number
  showDescription: boolean
  blockHeight: number
}): GroupElement {
  const titleWidth = estimatedTextWidth(TITLE_SAMPLE)
  const pageLabel = formatTocPageLabel(String(options.pageNumber), options.settings.numberFormat)
  const numberWidth = estimatedTextWidth(pageLabel)
  const detailHeight = Math.max(0, options.blockHeight - ROW_HEIGHT - DETAIL_GAP)
  return {
    id: generateElementId('group'),
    type: 'group',
    name: options.name,
    position: { x: options.x, y: options.y },
    size: { width: titleWidth + NUMBER_GAP + numberWidth, height: options.blockHeight },
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    listId: options.listId,
    listOrder: options.order,
    list: options.settings,
    listColumnBreak: options.columnBreak,
    children: [
      tocText({
        name: 'Название',
        role: 'item',
        text: TITLE_SAMPLE,
        x: 0,
        width: titleWidth,
        align: 'left',
      }),
      tocText({
        name: 'Описание',
        role: 'detail',
        text: options.showDescription ? DESCRIPTION_SAMPLE : '',
        x: 0,
        y: options.showDescription ? ROW_HEIGHT + DETAIL_GAP : 0,
        width: titleWidth,
        align: 'left',
        visible: options.showDescription,
        fontSize: DETAIL_FONT_SIZE,
        height: options.showDescription ? detailHeight : 0,
      }),
      tocText({
        name: 'Страница',
        role: 'number',
        text: pageLabel,
        x: titleWidth + NUMBER_GAP,
        width: numberWidth,
        align: 'left',
      }),
    ],
  }
}

function tocText(options: {
  name: string
  role: 'item' | 'number' | 'detail' | null
  text: string
  x: number
  y?: number
  width: number
  align: 'left' | 'right' | 'center'
  visible?: boolean
  fontSize?: number
  height?: number
}): TextPlaceholder {
  const detail = options.role === 'detail'
  return {
    id: generateElementId('text-placeholder'),
    type: 'text-placeholder',
    name: options.name,
    label: options.name,
    position: { x: options.x, y: options.y ?? 0 },
    size: {
      width: options.width,
      height: options.height ?? (detail || options.visible === false ? 0 : ROW_HEIGHT),
    },
    rotation: 0,
    locked: false,
    visible: options.visible ?? !detail,
    opacity: 1,
    defaultText: options.text,
    listRole: options.role,
    fontFamily: EDITOR_FONT_BODY,
    fontSize: options.fontSize ?? (detail ? DETAIL_FONT_SIZE : TITLE_FONT_SIZE),
    fontWeight: 400,
    fontItalic: false,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: options.align,
    verticalAlign: 'middle',
    textTransform: 'none',
    textSizingMode: 'fixed',
    color: '#111111',
    maxLength: options.role === 'number' ? 8 : 80,
    required: false,
    effect: null,
  }
}

function setVisible(node: PageElement, visible: boolean): PageElement {
  if (isGroupElement(node)) {
    return { ...node, visible, children: node.children.map((child) => setVisible(child, visible)) }
  }
  return { ...node, visible }
}

function findText(node: PageElement, id: string): TextPlaceholder | null {
  if (isTextElement(node)) {
    return node.id === id ? node : null
  }
  if (!isGroupElement(node)) {
    return null
  }
  for (const child of node.children) {
    const found = findText(child, id)
    if (found) {
      return found
    }
  }
  return null
}
