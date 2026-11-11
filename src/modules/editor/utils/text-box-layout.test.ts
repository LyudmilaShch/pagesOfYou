import { describe, expect, it } from 'vitest'

import { fitFontSizeToBox, TEXT_FIT_MIN_FONT_SCALE } from './text-fit-font.util'
import { layoutTextBox, positionForTopLeftAnchor } from './text-auto-size.util'
import type { TextMeasureSnapshot } from './text-measure.util'

function measureOf(naturalWidth: number, lineHeight = 20): TextMeasureSnapshot {
  return {
    naturalWidth,
    naturalHeight: lineHeight,
    heightAtWidth: (width) =>
      lineHeight * Math.max(1, Math.ceil(naturalWidth / width)),
  }
}

describe('layoutTextBox', () => {
  it('hugs a new element to the line, and stops at the page edge', () => {
    expect(
      layoutTextBox({
        mode: 'auto',
        fit: 'hug',
        current: { width: 80, height: 48 },
        anchorX: 0,
        pageWidth: 400,
        measure: measureOf(120),
      }),
    ).toEqual({ width: 120, height: 20 })

    expect(
      layoutTextBox({
        mode: 'auto',
        fit: 'hug',
        current: { width: 80, height: 48 },
        anchorX: 0,
        pageWidth: 100,
        measure: measureOf(250, 20),
      }),
    ).toEqual({ width: 100, height: 60 })
  })

  it('grows width and height but never shrinks them, so typing cannot breathe', () => {
    const wide = layoutTextBox({
      mode: 'auto',
      fit: 'grow',
      current: { width: 200, height: 40 },
      anchorX: 10,
      pageWidth: 500,
      measure: measureOf(80),
    })
    expect(wide).toEqual({ width: 200, height: 40 })

    const grown = layoutTextBox({
      mode: 'auto',
      fit: 'grow',
      current: wide,
      anchorX: 10,
      pageWidth: 500,
      measure: measureOf(260),
    })
    expect(grown).toEqual({ width: 260, height: 40 })

    const again = layoutTextBox({
      mode: 'auto',
      fit: 'grow',
      current: grown,
      anchorX: 10,
      pageWidth: 500,
      measure: measureOf(260),
    })
    expect(again).toEqual(grown)
  })

  it('wraps at the page edge and stays there on the next keystroke', () => {
    const wrapped = layoutTextBox({
      mode: 'auto',
      fit: 'grow',
      current: { width: 180, height: 20 },
      anchorX: 50,
      pageWidth: 250,
      measure: measureOf(400, 20),
    })
    expect(wrapped).toEqual({ width: 200, height: 40 })

    const next = layoutTextBox({
      mode: 'auto',
      fit: 'grow',
      current: wrapped,
      anchorX: 50,
      pageWidth: 250,
      measure: measureOf(390, 20),
    })
    expect(next).toEqual(wrapped)
  })

  it('keeps a user-set width and only grows the height', () => {
    expect(
      layoutTextBox({
        mode: 'fixed',
        fit: 'grow',
        current: { width: 100, height: 20 },
        anchorX: 0,
        pageWidth: 800,
        measure: measureOf(350, 18),
      }),
    ).toEqual({ width: 100, height: 72 })
  })
})

describe('positionForTopLeftAnchor', () => {
  it('does not move an unrotated box when the size changes', () => {
    const position = { x: 40, y: 70 }
    expect(
      positionForTopLeftAnchor(
        position,
        { width: 100, height: 20 },
        { width: 140, height: 60 },
        0,
      ),
    ).toBe(position)
  })

  it('keeps the rotated top-left corner in place when the box grows down', () => {
    const before = { x: 10, y: 20 }
    const oldSize = { width: 100, height: 40 }
    const newSize = { width: 100, height: 80 }
    const after = positionForTopLeftAnchor(before, oldSize, newSize, 90)

    expect(after).toEqual({ x: -10, y: 0 })
    expect(localOrigin(after, newSize, 90)).toEqual(
      localOrigin(before, oldSize, 90),
    )

    expect(positionForTopLeftAnchor(after, newSize, newSize, 90)).toEqual(after)
  })
})

describe('fitFontSizeToBox', () => {
  it('keeps the design size when the text already fits', () => {
    expect(fitFontSizeToBox({ designFontSize: 22, fits: () => true })).toBe(22)
  })

  it('picks the largest size that fits and never goes below half the design size', () => {
    expect(
      fitFontSizeToBox({
        designFontSize: 20,
        fits: (size) => size <= 13,
      }),
    ).toBe(13)

    const min = Math.round(20 * TEXT_FIT_MIN_FONT_SCALE)
    expect(fitFontSizeToBox({ designFontSize: 20, fits: () => false })).toBe(
      min,
    )
  })
})

function localOrigin(
  position: { x: number; y: number },
  size: { width: number; height: number },
  rotationDeg: number,
): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rx = -size.width / 2
  const ry = -size.height / 2

  return {
    x: position.x + size.width / 2 + rx * cos - ry * sin,
    y: position.y + size.height / 2 + rx * sin + ry * cos,
  }
}
