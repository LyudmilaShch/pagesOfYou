import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isForeignDraftLock, type DraftLock } from './draft-tab-lock.util.ts'

const NOW = 1_000_000

function lock(overrides: Partial<DraftLock> = {}): DraftLock {
  return { draftId: 'local-a', tabId: 'tab-other', at: NOW - 1000, ...overrides }
}

describe('isForeignDraftLock', () => {
  it('warns when another tab still holds this draft', () => {
    assert.equal(isForeignDraftLock(lock(), 'tab-mine', 'local-a', NOW), true)
  })

  it('ignores our own lock, a different draft, and a stale heartbeat', () => {
    assert.equal(isForeignDraftLock(lock({ tabId: 'tab-mine' }), 'tab-mine', 'local-a', NOW), false)
    assert.equal(isForeignDraftLock(lock(), 'tab-mine', 'local-b', NOW), false)
    assert.equal(isForeignDraftLock(lock({ at: NOW - 20_000 }), 'tab-mine', 'local-a', NOW), false)
    assert.equal(isForeignDraftLock(null, 'tab-mine', 'local-a', NOW), false)
  })
})
