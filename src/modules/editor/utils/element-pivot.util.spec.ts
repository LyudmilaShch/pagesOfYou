import { describe, expect, it } from 'vitest'

import { topLeftFromResizedCenter } from './element-pivot.util'

describe('topLeftFromResizedCenter', () => {
  it('keeps the right edge when the box is shrunk from the left', () => {
    // Box was at x=100, width=200, so the right edge sat at 300.
    // A left-edge shrink to 160 moves the center to 220. The left edge
    // must follow to 140 — keeping the old left edge would jump the photo back.
    expect(
      topLeftFromResizedCenter({ x: 220, y: 90 }, { width: 160, height: 100 }),
    ).toEqual({ x: 140, y: 40 })
  })

  it('keeps the left edge when the box is shrunk from the right', () => {
    expect(
      topLeftFromResizedCenter({ x: 180, y: 90 }, { width: 160, height: 100 }),
    ).toEqual({ x: 100, y: 40 })
  })

  it('keeps the bottom edge when the box is shrunk from the top', () => {
    expect(
      topLeftFromResizedCenter({ x: 200, y: 110 }, { width: 200, height: 60 }),
    ).toEqual({ x: 100, y: 80 })
  })
})
