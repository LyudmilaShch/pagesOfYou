import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readPhotoDropTarget, type PhotoDropHitSource } from './photo-touch-drag.util.ts'

function hit(map: Record<string, { dataset: Record<string, string> }>): PhotoDropHitSource {
  return {
    closest(selector: string) {
      return map[selector] ?? null
    },
  }
}

describe('readPhotoDropTarget', () => {
  it('returns the page and slot stamped on the book', () => {
    assert.deepEqual(
      readPhotoDropTarget(
        hit({
          '[data-element-id]': { dataset: { elementId: 'slot-1' } },
          '[data-page-id]': { dataset: { pageId: 'cover' } },
        }),
      ),
      { pageId: 'cover', elementId: 'slot-1' },
    )
  })

  it('returns null when the finger is not over a photo slot', () => {
    assert.equal(readPhotoDropTarget(null), null)
    assert.equal(
      readPhotoDropTarget(
        hit({
          '[data-page-id]': { dataset: { pageId: 'cover' } },
        }),
      ),
      null,
    )
  })
})
