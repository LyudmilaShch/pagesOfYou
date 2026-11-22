import { describe, expect, it } from 'vitest'

import type { PageElement } from '../models'
import type { ListSettings } from '../models/list.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import {
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '../constants/page.constants'
import { pageHasPrintCropViolation } from './print-safe-zone.util'
import { shapeLineLocalBounds } from './element-bounds.util'
import { selectionOutlineBounds } from './selection-outline.util'
import { inkRectFromLineWidths } from './text-measure.util'

const LIST = { questionKey: null, source: 'toc' } as ListSettings

function text(id: string, x: number, y: number, width: number, height: number): TextPlaceholder {
  return {
    id,
    type: 'text-placeholder',
    name: id,
    label: id,
    position: { x, y },
    size: { width, height },
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    defaultText: id,
    fontFamily: 'Arial',
    fontSize: 15,
    fontWeight: 400,
    fontItalic: false,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'left',
    verticalAlign: 'top',
    textTransform: 'none',
    textSizingMode: 'fixed',
    color: '#111111',
    maxLength: 80,
    required: false,
    effect: null,
  }
}

function row(children: PageElement[], width: number, height: number): PageElement {
  return {
    id: 'row',
    type: 'group',
    name: 'row',
    position: { x: 40, y: 56 },
    size: { width, height },
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    listId: 'list-1',
    listOrder: 0,
    list: LIST,
    children,
  } as PageElement
}

describe('inkRectFromLineWidths', () => {
  it('lets a right-aligned line wider than the frame spill to the left', () => {
    expect(
      inkRectFromLineWidths({
        boxWidth: 20,
        boxHeight: 18,
        lineWidths: [36],
        blockHeight: 18,
        align: 'right',
        verticalAlign: 'top',
      }),
    ).toEqual({ x: -16, y: 0, width: 36, height: 18 })
  })

  it('hugs a short left-aligned line instead of the whole frame', () => {
    expect(
      inkRectFromLineWidths({
        boxWidth: 400,
        boxHeight: 18,
        lineWidths: [90],
        blockHeight: 18,
        align: 'left',
        verticalAlign: 'top',
      }),
    ).toEqual({ x: 0, y: 0, width: 90, height: 18 })
  })
})

describe('selectionOutlineBounds', () => {
  const ink = (element: TextPlaceholder) => {
    if (element.id === 'number') {
      return { x: -16, y: 0, width: 36, height: 18 }
    }
    return { x: 0, y: 0, width: 90, height: 18 }
  }

  it('includes a page number that paints to the left of the row box', () => {
    const bounds = selectionOutlineBounds(
      row(
        [text('number', 0, 0, 20, 18), text('title', 24, 0, 200, 18)],
        400,
        18,
      ),
      ink,
    )

    expect(bounds.x).toBe(-16)
    expect(bounds.width).toBe(24 + 90 - -16)
  })

  it('stops the dash at the words when the row frame is wider than the text', () => {
    const bounds = selectionOutlineBounds(row([text('title', 0, 0, 400, 18)], 400, 40), ink)

    expect(bounds).toEqual({ x: 0, y: 0, width: 90, height: 18 })
  })

  it('includes a vertical line placed in the row', () => {
    const line = {
      id: 'rule',
      type: 'shape-line',
      name: 'Линия',
      position: { x: -50, y: 0 },
      size: { width: 40, height: 0 },
      rotation: 90,
      locked: false,
      visible: true,
      opacity: 1,
      fill: 'transparent',
      stroke: '#111111',
      strokeWidth: 2,
      cornerRadius: 0,
      shadow: null,
      visualEffect: null,
    } as PageElement
    const local = shapeLineLocalBounds({
      size: line.size,
      rotation: line.rotation,
      strokeWidth: 2,
    })

    const bounds = selectionOutlineBounds(row([line, text('title', 0, 0, 200, 18)], 200, 18), ink)

    expect(bounds.x).toBeCloseTo(line.position.x + local.x)
    expect(bounds.x).toBeLessThan(0)
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(90)
  })

  it('keeps a plain group frame when the children sit inside it', () => {
    const group = {
      ...row([text('title', 10, 4, 40, 18)], 200, 40),
      listId: undefined,
      list: undefined,
    } as PageElement

    expect(selectionOutlineBounds(group, ink)).toEqual({ x: 0, y: 0, width: 200, height: 40 })
  })
})

describe('print crop against the text frame', () => {
  const spreadWidth = A4_SPREAD_PAGE_WIDTH
  const spreadHeight = A4_SPREAD_PAGE_HEIGHT

  it('warns when a contents text frame crosses the fold, even if the sample words are short', () => {
    const group = row([text('title', 0, 0, 560, 20)], 560, 20)

    expect(pageHasPrintCropViolation([group], spreadWidth, spreadHeight)).toBe(true)
  })

  it('does not warn when the text frame stays inside the trim', () => {
    const group = row([text('title', 0, 0, 200, 20)], 200, 20)

    expect(pageHasPrintCropViolation([group], spreadWidth, spreadHeight)).toBe(false)
  })

  it('warns when the text frame enters the trim', () => {
    const group = {
      ...row([text('title', 0, 0, 40, 18)], 40, 18),
      position: { x: 2, y: 56 },
    }

    expect(pageHasPrintCropViolation([group], spreadWidth, spreadHeight)).toBe(true)
  })

  it('warns when a line in the row enters the trim while the text frame stays inside', () => {
    const rule = {
      id: 'rule',
      type: 'shape-line',
      name: 'Линия',
      position: { x: -36, y: 10 },
      size: { width: 20, height: 0 },
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      fill: 'transparent',
      stroke: '#111111',
      strokeWidth: 1,
      cornerRadius: 0,
      shadow: null,
      visualEffect: null,
    } as PageElement
    const group = row([rule, text('title', 0, 0, 200, 20)], 200, 20)

    expect(pageHasPrintCropViolation([group], spreadWidth, spreadHeight)).toBe(true)
  })
})
