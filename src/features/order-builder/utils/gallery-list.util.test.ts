import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { prependUniqueById } from './gallery-list.util.ts'

describe('prependUniqueById', () => {
  it('puts a photo uploaded from the picker at the front of the page gallery', () => {
    const existing = [{ id: 'a', url: '/a.jpg' }]
    const uploaded = { id: 'b', url: '/b.jpg' }
    assert.deepEqual(prependUniqueById(existing, uploaded), [uploaded, existing[0]])
  })

  it('does not add the same file twice', () => {
    const existing = [{ id: 'a', url: '/a.jpg' }]
    const again = prependUniqueById(existing, { id: 'a', url: '/a-copy.jpg' })
    assert.equal(again.length, 1)
    assert.equal(again[0].url, '/a.jpg')
    assert.notEqual(again, existing)
  })
})
