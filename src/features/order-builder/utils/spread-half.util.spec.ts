import { describe, expect, it } from 'vitest'

import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import type { PageElement } from '@/modules/editor/models'

import { preferredEmptySlotElementId, spreadHalfForElement } from './spread-half.util'

function photo(id: string, x: number, width = 100): PageElement {
  return {
    id,
    type: 'photo-placeholder',
    position: { x, y: 40 },
    size: { width, height: 120 },
    rotation: 0,
  } as PageElement
}

const spread = {
  pageWidth: A4_SPREAD_PAGE_WIDTH,
  pageHeight: A4_SPREAD_PAGE_HEIGHT,
}

describe('spreadHalfForElement', () => {
  it('returns the half that contains the element center', () => {
    const canvas = {
      ...spread,
      elements: [photo('left-slot', 40), photo('right-slot', A4_PAGE_WIDTH + 40)],
    }

    expect(spreadHalfForElement(canvas, 'left-slot')).toBe('left')
    expect(spreadHalfForElement(canvas, 'right-slot')).toBe('right')
  })

  it('uses the element center when the slot crosses the fold', () => {
    const width = 80
    const canvas = {
      ...spread,
      elements: [photo('mostly-right', A4_PAGE_WIDTH - width / 2 + 1, width)],
    }

    expect(spreadHalfForElement(canvas, 'mostly-right')).toBe('right')
  })

  it('returns null for a single page, a missing element, or no target', () => {
    const canvas = {
      pageWidth: A4_PAGE_WIDTH,
      pageHeight: A4_PAGE_HEIGHT,
      elements: [photo('cover', 20)],
    }

    expect(spreadHalfForElement(canvas, 'cover')).toBeNull()
    expect(spreadHalfForElement({ ...spread, elements: [] }, 'missing')).toBeNull()
    expect(spreadHalfForElement({ ...spread, elements: [photo('slot', 40)] }, null)).toBeNull()
  })
})

describe('preferredEmptySlotElementId', () => {
  const canvas = {
    ...spread,
    elements: [photo('right-slot', A4_PAGE_WIDTH + 40), photo('left-slot', 40)],
  }

  it('opens the left page when both halves have an empty slot', () => {
    expect(preferredEmptySlotElementId(canvas, ['right-slot', 'left-slot'])).toBe('left-slot')
  })

  it('opens the right page when only that half is empty', () => {
    expect(preferredEmptySlotElementId(canvas, ['right-slot'])).toBe('right-slot')
  })
})
