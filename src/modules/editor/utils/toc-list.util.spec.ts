import { describe, expect, it } from 'vitest'

import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '../constants/page.constants'
import { isGroupElement, isTextElement, type LeafElement, type PageElement, type TextPlaceholder } from '../models'
import { flattenTree } from './element-tree.util'
import { distributeLists } from './list-distribution.util'
import {
  applyTocEntries,
  buildTocAdminSamples,
  createTocListRows,
  formatTocPageLabel,
  refreshTocRows,
  seedTocDescriptionSamples,
  tightenTocRows,
  tocFilledItemIds,
  TOC_ROWS_PER_COLUMN,
} from './toc-list.util'

function layOut(entries: Array<{ pageId: string; title: string; pageLabel: string }>): PageElement[] {
  const rows = createTocListRows(A4_SPREAD_PAGE_WIDTH, A4_SPREAD_PAGE_HEIGHT).map((row) => ({
    ...row,
    list: { ...row.list!, heightMode: 'fixed' as const },
  }))
  const prepared = applyTocEntries(rows, entries)
  const filled = tocFilledItemIds(prepared)
  return distributeLists(prepared, {
    isItemFilled: (id) => filled.has(id),
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
  })
}

function isNumberText(leaf: LeafElement): leaf is TextPlaceholder {
  return isTextElement(leaf) && leaf.listRole === 'number'
}

function visibleTitles(elements: PageElement[]): string[] {
  return flattenTree(elements)
    .filter((leaf) => isTextElement(leaf) && leaf.listRole === 'item' && leaf.visible)
    .map((leaf) => (isTextElement(leaf) ? (leaf.defaultText ?? '') : ''))
}

describe('buildTocAdminSamples', () => {
  it('follows the default journal, then the longest remaining pages that have both texts', () => {
    const long = 'Самый длинный рассказ о доме и дворе'
    const samples = buildTocAdminSamples({
      includedSpreads: 8,
      rowCount: 8,
      defaultSpreads: [
        { layoutMode: 'SPREAD', magazinePageId: 'a', rightMagazinePageId: null },
        { layoutMode: 'SPREAD', magazinePageId: 'b', rightMagazinePageId: null },
      ],
      pages: [
        { id: 'toc', name: 'Содержание', pageType: 'TOC' },
        { id: 'a', name: 'Детство', description: 'Коротко', pageType: 'SPREAD' },
        { id: 'b', name: 'Школа', pageType: 'SPREAD' },
        { id: 'c', name: 'Дом', description: long, pageType: 'SPREAD' },
        { id: 'd', name: 'Работа', pageType: 'PAGE' },
      ],
    })

    expect(samples.slice(0, 6).map((sample) => sample.title)).toEqual([
      'Детство',
      'Школа',
      'Школа',
      'Школа',
      'Школа',
      'Школа',
    ])
    expect(samples[6]).toEqual({ title: 'Дом', description: long })
    expect(samples[7]?.title).toBe('Работа')
    expect(samples[6]?.description.length).toBeGreaterThan(samples[0]?.description.length ?? 0)
  })
})

describe('createTocListRows', () => {
  it('places a column on each page of a spread', () => {
    const rows = createTocListRows(A4_SPREAD_PAGE_WIDTH, A4_SPREAD_PAGE_HEIGHT)
    const left = rows.filter((row) => row.position.x < A4_PAGE_WIDTH)
    const right = rows.filter((row) => row.position.x >= A4_PAGE_WIDTH)

    expect(left).toHaveLength(TOC_ROWS_PER_COLUMN)
    expect(right).toHaveLength(TOC_ROWS_PER_COLUMN)
    expect(right[0]?.listColumnBreak).toBe(true)
    expect(new Set(rows.map((row) => row.listId)).size).toBe(1)
  })

  it('keeps a single page in one column', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)
    expect(rows).toHaveLength(TOC_ROWS_PER_COLUMN)
    expect(rows.every((row) => row.position.x < A4_PAGE_WIDTH)).toBe(true)
  })

  it('can be created with a description line already in place', () => {
    const [row] = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT, { showDescription: true })
    const detail = row.children.find((child) => isTextElement(child) && child.listRole === 'detail')
    expect(row.list?.showDescription).toBe(true)
    expect(isTextElement(detail) && detail.visible && detail.defaultText).toBe('Описание раздела')
    expect(row.size.height).toBeGreaterThan(20)
  })

  it('numbers the rows the way a journal does: 3, then 5, then 7', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)
    const labels = rows.slice(0, 3).map((row) => {
      const number = row.children.find((child) => isTextElement(child) && child.listRole === 'number')
      return isTextElement(number) ? number.defaultText : ''
    })
    expect(labels).toEqual(['3', '5', '7'])
  })

  it('sizes each row to the sample words', () => {
    const [row] = createTocListRows(A4_SPREAD_PAGE_WIDTH, A4_SPREAD_PAGE_HEIGHT)
    expect(row.size.width).toBeLessThan(250)
    expect(row.size.height).toBeLessThan(40)
  })
})

describe('tightenTocRows', () => {
  it('shrinks a stretched frame to the words and leaves a moved page number where it is', () => {
    const row = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)[0]
    row.size = { width: 500, height: 400 }
    const title = row.children.find((child) => isTextElement(child) && child.listRole === 'item')
    const number = row.children.find((child) => isTextElement(child) && child.listRole === 'number')
    if (!title || !number || !isTextElement(title) || !isTextElement(number)) {
      throw new Error('row is missing its texts')
    }
    title.size = { width: 460, height: 32 }
    number.position = { x: 8, y: 0 }
    number.size = { width: 36, height: 32 }

    const fitted = tightenTocRows([row], () => ({ width: 120, height: 18 }))
    const group = fitted[0]
    if (!group || !isGroupElement(group)) {
      throw new Error('expected a group')
    }
    const fittedNumber = group.children.find((child) => isTextElement(child) && child.listRole === 'number')

    expect(group.size.height).toBe(18)
    expect(group.size.width).toBeLessThan(200)
    expect(fittedNumber?.position.x).toBe(8)
  })

  it('drops the empty height but keeps a page number that sits on the right edge', () => {
    const row = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)[0]
    row.size = { width: 500, height: 400 }
    const number = row.children.find((child) => isTextElement(child) && child.listRole === 'number')
    if (!number || !isTextElement(number)) {
      throw new Error('row is missing its page number')
    }
    number.position = { x: 464, y: 0 }
    number.size = { width: 36, height: 32 }

    const fitted = tightenTocRows([row], (text) =>
      text.listRole === 'number' ? { width: 24, height: 18 } : { width: 120, height: 18 },
    )
    const group = fitted[0]
    if (!group || !isGroupElement(group)) {
      throw new Error('expected a group')
    }
    const fittedNumber = group.children.find((child) => isTextElement(child) && child.listRole === 'number')
    if (!fittedNumber || !isTextElement(fittedNumber)) {
      throw new Error('fitted row is missing its page number')
    }

    expect(fittedNumber.position.x).toBe(464)
    expect(group.size.width).toBe(500)
    expect(group.size.height).toBeLessThan(40)
  })

  it('leaves a one-line row untouched', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)
    const again = tightenTocRows(rows, (text) => ({
      width: text.size.width,
      height: text.size.height,
    }))
    expect(again).toBe(rows)
  })
})

describe('applyTocEntries', () => {
  it('fills the spread with journal titles and keeps the real page numbers', () => {
    const laid = layOut([
      { pageId: 'a', title: 'Детство', pageLabel: '3' },
      { pageId: 'b', title: 'Школа', pageLabel: '5' },
      { pageId: 'c', title: 'Дом', pageLabel: '9' },
    ])
    const visible = flattenTree(laid).filter((leaf) => isTextElement(leaf) && leaf.visible && leaf.listRole)

    expect(visibleTitles(laid)).toEqual(['Детство', 'Школа', 'Дом'])
    expect(visible.filter(isNumberText).map((leaf) => leaf.defaultText ?? '')).toEqual(['3', '5', '9'])

    // Default layout is "по местам шаблона": three sections land on the first, middle and last row,
    // so one stays on the left page and the others move to the right.
    const titles = flattenTree(laid).filter((leaf) => isTextElement(leaf) && leaf.listRole === 'item' && leaf.visible)
    expect(titles.some((leaf) => leaf.position.x < A4_PAGE_WIDTH)).toBe(true)
    expect(titles.some((leaf) => leaf.position.x >= A4_PAGE_WIDTH)).toBe(true)
  })

  it('keeps a "from the start" layout on the first rows the admin placed', () => {
    const rows = createTocListRows(A4_SPREAD_PAGE_WIDTH, A4_SPREAD_PAGE_HEIGHT).map((row) => ({
      ...row,
      list: { ...row.list!, mode: 'start' as const, heightMode: 'fixed' as const },
    }))
    const prepared = applyTocEntries(rows, [
      { pageId: 'a', title: 'Детство', pageLabel: '3' },
      { pageId: 'b', title: 'Школа', pageLabel: '5' },
      { pageId: 'c', title: 'Дом', pageLabel: '9' },
    ])
    const filled = tocFilledItemIds(prepared)
    const laid = distributeLists(prepared, {
      isItemFilled: (id) => filled.has(id),
      pageWidth: A4_SPREAD_PAGE_WIDTH,
      pageHeight: A4_SPREAD_PAGE_HEIGHT,
    })
    const titles = flattenTree(laid).filter((leaf) => isTextElement(leaf) && leaf.listRole === 'item' && leaf.visible)
    expect(titles).toHaveLength(3)
    expect(titles.every((leaf) => leaf.position.x < A4_PAGE_WIDTH)).toBe(true)
  })

  it('hides the contents when the journal has no sections', () => {
    const laid = layOut([])
    expect(visibleTitles(laid)).toEqual([])
  })

  it('writes the description and the chosen number format', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT).map((row) => ({
      ...row,
      list: { ...row.list!, numberFormat: 'page' as const, showDescription: true },
    }))
    const [first] = applyTocEntries(rows, [
      { pageId: 'a', title: 'Детство', pageLabel: '3', description: 'Первые годы' },
    ])
    if (!isGroupElement(first)) {
      throw new Error('row is not a group')
    }
    const detail = first.children.find((child) => isTextElement(child) && child.listRole === 'detail')
    const number = first.children.find((child) => isTextElement(child) && child.listRole === 'number')
    expect(isTextElement(detail) && detail.visible && detail.defaultText).toBe('Первые годы')
    expect(isTextElement(number) && number.defaultText).toBe('стр. 3')
  })

  it('keeps the description hidden until the contents ask for it, then shows a sample without moving the other rows', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)
    const [hidden] = applyTocEntries(rows, [
      { pageId: 'a', title: 'Детство', pageLabel: '3', description: 'Первые годы' },
    ])
    if (!isGroupElement(hidden)) {
      throw new Error('row is not a group')
    }
    const hiddenDetail = hidden.children.find((child) => isTextElement(child) && child.listRole === 'detail')
    expect(isTextElement(hiddenDetail) && hiddenDetail.visible).toBe(false)

    const withFlag = rows.map((row) => ({ ...row, list: { ...row.list!, showDescription: true } }))
    const seeded = seedTocDescriptionSamples(withFlag)
    const shown = refreshTocRows(seeded)
    const detail = shown[0] && isGroupElement(shown[0])
      ? shown[0].children.find((child) => isTextElement(child) && child.listRole === 'detail')
      : null
    expect(isTextElement(detail) && detail.visible && detail.defaultText).toBe('Описание раздела')
    expect(shown[1].position.y).toBe(rows[1].position.y)
    expect(shown[1].position.x).toBe(rows[1].position.x)
  })

  it('grows a wrapped long title and leaves a one-line title when the font shrinks', () => {
    const long = 'Очень длинное название раздела, которое не помещается в одну строку'
    const wrapped = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT).map((row) => ({
      ...row,
      list: { ...row.list!, titleFit: 'wrap' as const },
    }))
    const shrunk = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT).map((row) => ({
      ...row,
      list: { ...row.list!, titleFit: 'shrink' as const },
    }))
    const wrapTitle = titleOf(applyTocEntries(wrapped, [{ pageId: 'a', title: long, pageLabel: '4' }]))
    const shrinkTitle = titleOf(applyTocEntries(shrunk, [{ pageId: 'a', title: long, pageLabel: '4' }]))
    expect(wrapTitle.size.height).toBeGreaterThan(30)
    expect(shrinkTitle.fontSize).toBeLessThan(15)
    expect(shrinkTitle.size.height).toBeLessThan(30)
  })
})

describe('formatTocPageLabel', () => {
  it('pads, prefixes and leaves a non-numeric label alone', () => {
    expect(formatTocPageLabel('3', 'plain')).toBe('3')
    expect(formatTocPageLabel('3', 'pad2')).toBe('03')
    expect(formatTocPageLabel('3', 'page')).toBe('стр. 3')
    expect(formatTocPageLabel('3–4', 'pad2')).toBe('3–4')
  })
})

describe('refreshTocRows', () => {
  it('does not rewrite a real page number', () => {
    const rows = createTocListRows(A4_PAGE_WIDTH, A4_PAGE_HEIGHT)
    const number = rows[0].children.find((child) => isTextElement(child) && child.listRole === 'number')
    if (!isTextElement(number)) {
      throw new Error('missing number')
    }
    number.defaultText = '12'
    const refreshed = refreshTocRows(rows)
    const first = refreshed[0]
    if (!isGroupElement(first)) {
      throw new Error('row is not a group')
    }
    const kept = first.children.find((child) => isTextElement(child) && child.listRole === 'number')
    expect(isTextElement(kept) && kept.defaultText).toBe('12')
  })
})

function titleOf(elements: PageElement[]): TextPlaceholder {
  const title = flattenTree(elements).find((leaf) => isTextElement(leaf) && leaf.listRole === 'item')
  if (!isTextElement(title)) {
    throw new Error('missing title')
  }
  return title
}
