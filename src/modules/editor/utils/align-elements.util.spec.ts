import { describe, expect, it } from 'vitest'

import type { PageElement } from '../models'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import { getTextInkRect } from './text-measure.util'
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  PRINT_SAFE_MARGIN,
} from '../constants/page.constants'
import {
  alignGroupToFrame,
  stretchElementToFrame,
  distributeInFrame,
  packAndCenterInFrame,
  resolveLayoutGroups,
  type LayoutFrame,
} from './align-elements.util'

function box(id: string, x: number, y: number, width: number, height: number): PageElement {
  return {
    id,
    type: 'shape-rectangle',
    name: id,
    position: { x, y },
    size: { width, height },
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
  } as PageElement
}

const PAGE: LayoutFrame = { x: 0, y: 0, width: 100, height: 80 }

describe('alignGroupToFrame', () => {
  it('pins AI text to the bottom by the lines that paint below the frame', () => {
    const preview = 'Здесь появится текст. '.repeat(12).trim()
    const element = {
      id: 'ai',
      type: 'ai-text-placeholder',
      name: 'AI',
      label: 'AI',
      position: { x: 40, y: 10 },
      size: { width: 120, height: 28 },
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      previewPlaceholderText: preview,
      fontFamily: 'Arial',
      fontSize: 16,
      fontWeight: 400,
      fontItalic: false,
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'left',
      verticalAlign: 'top',
      textTransform: 'none',
      contentSource: 'questions',
      chainMode: 'continuous',
      lengthConstraint: { unit: 'characters', min: null, max: 200 },
    } as PageElement
    const ink = getTextInkRect(element as unknown as TextPlaceholder, preview)
    const frame: LayoutFrame = { x: 0, y: 0, width: 400, height: 500 }

    expect(ink.height).toBeGreaterThan(element.size.height)

    const y = alignGroupToFrame([element], frame, 'bottom').get('ai')?.y ?? element.position.y
    const paintedBottom = y + Math.max(element.size.height, ink.y + ink.height)

    expect(Math.abs(paintedBottom - frame.height)).toBeLessThanOrEqual(1)
    expect(y + element.size.height).toBeLessThan(frame.height)
  })

  it('moves one element to the requested edge of the frame', () => {
    const element = box('a', 30, 20, 10, 8)

    expect(alignGroupToFrame([element], PAGE, 'left').get('a')).toEqual({ x: 0 })
    expect(alignGroupToFrame([element], PAGE, 'right').get('a')).toEqual({ x: 90 })
    expect(alignGroupToFrame([element], PAGE, 'top').get('a')).toEqual({ y: 0 })
    expect(alignGroupToFrame([element], PAGE, 'bottom').get('a')).toEqual({ y: 72 })
    expect(alignGroupToFrame([element], PAGE, 'center-horizontal').get('a')).toEqual({ x: 45 })
    expect(alignGroupToFrame([element], PAGE, 'center-vertical').get('a')).toEqual({ y: 36 })
  })

  const elements = [box('a', 10, 12, 20, 10), box('b', 40, 30, 10, 8)]

  it('slides the block to the left edge and keeps the gaps', () => {
    const patches = alignGroupToFrame(elements, PAGE, 'left')

    expect(patches.get('a')).toEqual({ x: 0 })
    expect(patches.get('b')).toEqual({ x: 30 })
  })

  it('slides the block to the right edge', () => {
    const patches = alignGroupToFrame(elements, PAGE, 'right')

    expect(patches.get('a')?.x).toBe(60)
    expect(patches.get('b')?.x).toBe(90)
  })

  it('centers the block horizontally', () => {
    const patches = alignGroupToFrame(elements, PAGE, 'center-horizontal')

    expect(patches.get('a')?.x).toBe(30)
    expect(patches.get('b')?.x).toBe(60)
  })

  it('slides the block to the top and bottom edges', () => {
    expect(alignGroupToFrame(elements, PAGE, 'top').get('a')).toEqual({ y: 0 })
    expect(alignGroupToFrame(elements, PAGE, 'top').get('b')?.y).toBe(18)

    expect(alignGroupToFrame(elements, PAGE, 'bottom').get('a')?.y).toBe(54)
    expect(alignGroupToFrame(elements, PAGE, 'bottom').get('b')?.y).toBe(72)
  })

  it('centers the block vertically', () => {
    const patches = alignGroupToFrame(elements, PAGE, 'center-vertical')

    expect(patches.get('a')?.y).toBe(27)
    expect(patches.get('b')?.y).toBe(45)
  })

  it('pins a block wider than the frame to the start, even when asked for the right edge', () => {
    const wide = [box('a', 5, 0, 80, 10), box('b', 90, 0, 50, 10)]
    const patches = alignGroupToFrame(wide, PAGE, 'right')

    expect(patches.get('a')?.x).toBe(0)
    expect(patches.get('b')?.x).toBe(85)
  })

  it('returns nothing when the block is already on the requested edge', () => {
    const aligned = [box('a', 0, 0, 10, 10), box('b', 20, 0, 10, 10)]

    expect(alignGroupToFrame(aligned, PAGE, 'left').size).toBe(0)
  })

  it('keeps words that sit left of the row box on the page', () => {
    const row = {
      id: 'row',
      type: 'group',
      name: 'row',
      position: { x: 700, y: 40 },
      size: { width: 200, height: 20 },
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      children: [
        {
          ...box('title', -160, 0, 180, 20),
        },
      ],
    } as PageElement
    const frame: LayoutFrame = { x: 613, y: 18, width: 559, height: 806 }

    const patches = alignGroupToFrame([row], frame, 'left')

    expect(patches.get('row')?.x).toBe(773)
    expect((patches.get('row')?.x ?? row.position.x) - 160).toBe(frame.x)
  })
})

describe('stretchElementToFrame', () => {
  it('meets both horizontal edges of the frame', () => {
    const photo = box('photo', 40, 12, 80, 50)

    expect(stretchElementToFrame(photo, PAGE, 'horizontal')).toEqual({ x: 0, width: 100 })
  })

  it('meets both vertical edges of the frame', () => {
    const photo = box('photo', 10, 20, 40, 30)

    expect(stretchElementToFrame(photo, PAGE, 'vertical')).toEqual({ y: 0, height: 80 })
  })

  it('leaves a photo that already spans the frame', () => {
    const photo = box('photo', 0, 0, 100, 80)

    expect(stretchElementToFrame(photo, PAGE, 'horizontal')).toBeNull()
    expect(stretchElementToFrame(photo, PAGE, 'vertical')).toBeNull()
  })

  it('uses an inset frame when the print margin is on', () => {
    const photo = box('photo', 30, 30, 40, 40)
    const safe = { x: 12, y: 12, width: 76, height: 56 }

    expect(stretchElementToFrame(photo, safe, 'horizontal')).toEqual({ x: 12, width: 76 })
  })
})

describe('distributeInFrame', () => {
  it('pins two elements to the frame edges', () => {
    const patches = distributeInFrame(
      [box('a', 5, 0, 20, 10), box('b', 40, 0, 30, 10)],
      PAGE,
      'horizontal',
    )

    expect(patches.get('a')).toEqual({ x: 0 })
    expect(patches.get('b')).toEqual({ x: 70 })
  })

  it('spaces three elements with equal gaps and pins the ends', () => {
    const patches = distributeInFrame(
      [box('c', 80, 0, 10, 10), box('a', 0, 4, 10, 10), box('b', 30, 8, 10, 10)],
      PAGE,
      'horizontal',
    )

    expect(patches.has('a')).toBe(false)
    expect(patches.get('b')).toEqual({ x: 45 })
    expect(patches.get('c')).toEqual({ x: 90 })
  })

  it('overlaps by an equal negative gap when the elements do not fit, keeping both ends on the frame', () => {
    const patches = distributeInFrame(
      [box('a', 10, 0, 60, 10), box('b', 80, 0, 60, 10)],
      PAGE,
      'horizontal',
    )

    expect(patches.get('a')).toEqual({ x: 0 })
    expect(patches.get('b')).toEqual({ x: 40 })
  })

  it('distributes along y and leaves x alone', () => {
    const patches = distributeInFrame(
      [box('a', 4, 10, 10, 20), box('b', 8, 40, 10, 20)],
      PAGE,
      'vertical',
    )

    expect(patches.get('a')).toEqual({ y: 0 })
    expect(patches.get('b')).toEqual({ y: 60 })
  })

  it('does nothing for a single element', () => {
    expect(distributeInFrame([box('a', 0, 0, 10, 10)], PAGE, 'horizontal').size).toBe(0)
  })
})

describe('packAndCenterInFrame', () => {
  it('packs with the given gap and centers the block', () => {
    const patches = packAndCenterInFrame(
      [box('b', 40, 3, 10, 10), box('a', 5, 3, 10, 10)],
      PAGE,
      'horizontal',
      10,
    )

    expect(patches.get('a')).toEqual({ x: 35 })
    expect(patches.get('b')).toEqual({ x: 55 })
  })

  it('pins the block to the start when it is wider than the frame', () => {
    const patches = packAndCenterInFrame(
      [box('a', 5, 0, 40, 10), box('b', 50, 0, 40, 10)],
      PAGE,
      'horizontal',
      30,
    )

    expect(patches.get('a')).toEqual({ x: 0 })
    expect(patches.get('b')).toEqual({ x: 70 })
  })

  it('ignores a gap that is not a number and a selection of one', () => {
    const elements = [box('a', 0, 0, 10, 10), box('b', 20, 0, 10, 10)]

    expect(packAndCenterInFrame(elements, PAGE, 'horizontal', Number.NaN).size).toBe(0)
    expect(packAndCenterInFrame([elements[0]], PAGE, 'horizontal', 10).size).toBe(0)
  })
})

describe('resolveLayoutGroups', () => {
  it('insets a plain page by the print margin', () => {
    const [group] = resolveLayoutGroups([box('a', 10, 10, 20, 20)], {
      pageWidth: A4_PAGE_WIDTH,
      pageHeight: A4_PAGE_HEIGHT,
      target: 'page',
      safeMargin: PRINT_SAFE_MARGIN,
    })

    expect(group.frame).toEqual({
      x: PRINT_SAFE_MARGIN,
      y: PRINT_SAFE_MARGIN,
      width: A4_PAGE_WIDTH - PRINT_SAFE_MARGIN * 2,
      height: A4_PAGE_HEIGHT - PRINT_SAFE_MARGIN * 2,
    })
  })

  it('keeps the full page when the margin would erase it', () => {
    const [group] = resolveLayoutGroups([box('a', 0, 0, 10, 10)], {
      pageWidth: 100,
      pageHeight: 80,
      target: 'page',
      safeMargin: 1000,
    })

    expect(group.frame).toEqual({ x: 0, y: 0, width: 100, height: 80 })
  })

  it('splits a spread into the halves the elements already sit on', () => {
    const groups = resolveLayoutGroups(
      [box('left', 40, 10, 80, 40), box('right', 700, 10, 80, 40)],
      {
        pageWidth: A4_SPREAD_PAGE_WIDTH,
        pageHeight: A4_SPREAD_PAGE_HEIGHT,
        target: 'page',
        safeMargin: PRINT_SAFE_MARGIN,
      },
    )

    expect(groups).toHaveLength(2)
    expect(groups[0].elements.map((element) => element.id)).toEqual(['left'])
    expect(groups[0].frame.x).toBe(PRINT_SAFE_MARGIN)
    expect(groups[0].frame.width).toBe(A4_PAGE_WIDTH - PRINT_SAFE_MARGIN * 2)
    expect(groups[1].elements.map((element) => element.id)).toEqual(['right'])
    expect(groups[1].frame.x).toBe(A4_PAGE_WIDTH + PRINT_SAFE_MARGIN)
    expect(groups[1].frame.width).toBe(A4_PAGE_WIDTH - PRINT_SAFE_MARGIN * 2)
  })

  it('puts an element whose center is on the fold onto the right page', () => {
    const groups = resolveLayoutGroups([box('fold', A4_PAGE_WIDTH - 5, 0, 10, 10)], {
      pageWidth: A4_SPREAD_PAGE_WIDTH,
      pageHeight: A4_SPREAD_PAGE_HEIGHT,
      target: 'page',
      safeMargin: 0,
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].frame.x).toBe(A4_PAGE_WIDTH)
  })

  it('uses the whole spread as one frame', () => {
    const [group] = resolveLayoutGroups(
      [box('left', 20, 0, 40, 40), box('right', 800, 0, 40, 40)],
      {
        pageWidth: A4_SPREAD_PAGE_WIDTH,
        pageHeight: A4_SPREAD_PAGE_HEIGHT,
        target: 'spread',
        safeMargin: PRINT_SAFE_MARGIN,
      },
    )

    expect(group.elements).toHaveLength(2)
    expect(group.frame).toEqual({
      x: PRINT_SAFE_MARGIN,
      y: PRINT_SAFE_MARGIN,
      width: A4_SPREAD_PAGE_WIDTH - PRINT_SAFE_MARGIN * 2,
      height: A4_SPREAD_PAGE_HEIGHT - PRINT_SAFE_MARGIN * 2,
    })
  })

  it('keeps a group-local frame and does not split or inset it', () => {
    const local = { x: 0, y: 0, width: 200, height: 100 }
    const [group] = resolveLayoutGroups(
      [box('left', 10, 0, 20, 20), box('right', 160, 0, 20, 20)],
      {
        pageWidth: A4_SPREAD_PAGE_WIDTH,
        pageHeight: A4_SPREAD_PAGE_HEIGHT,
        target: 'page',
        safeMargin: PRINT_SAFE_MARGIN,
        localFrame: local,
      },
    )

    expect(group.frame).toEqual(local)
    expect(group.elements).toHaveLength(2)
  })

  it('distributes a right-page group inside the right half only', () => {
    const elements = [box('a', 700, 0, 40, 20), box('b', 900, 0, 40, 20)]
    const [group] = resolveLayoutGroups(elements, {
      pageWidth: A4_SPREAD_PAGE_WIDTH,
      pageHeight: A4_SPREAD_PAGE_HEIGHT,
      target: 'page',
      safeMargin: 0,
    })
    const patches = distributeInFrame(group.elements, group.frame, 'horizontal')

    expect(patches.get('a')?.x).toBe(A4_PAGE_WIDTH)
    expect(patches.get('b')?.x).toBe(A4_SPREAD_PAGE_WIDTH - 40)
  })
})
