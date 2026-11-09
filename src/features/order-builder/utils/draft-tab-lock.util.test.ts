import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  hasOtherTabOnDraft,
  mergePresences,
  type TabPresence,
} from './draft-tab-lock.util.ts'

const NOW = 1_000_000

function presence(overrides: Partial<TabPresence> = {}): TabPresence {
  return { tabId: 'tab-other', draftId: 'local-a', at: NOW - 1_000, ...overrides }
}

describe('draft tab presence', () => {
  it('keeps the TTL well above the heartbeat so one late beat cannot hide the banner', () => {
    assert.ok(PRESENCE_TTL_MS >= PRESENCE_HEARTBEAT_MS * 3)
  })

  it('stays visible on both tabs while each keeps heartbeating the same draft', () => {
    const mine = presence({ tabId: 'tab-mine', at: NOW })
    const other = presence({ tabId: 'tab-other', at: NOW - PRESENCE_HEARTBEAT_MS })
    let shared = mergePresences([], [mine, other], NOW)

    assert.equal(hasOtherTabOnDraft(shared, 'tab-mine', 'local-a', NOW), true)
    assert.equal(hasOtherTabOnDraft(shared, 'tab-other', 'local-a', NOW), true)

    // Each heartbeat used to replace the single lock and clear the other tab's warning.
    shared = mergePresences(shared, [{ ...mine, at: NOW + PRESENCE_HEARTBEAT_MS }], NOW + PRESENCE_HEARTBEAT_MS)
    shared = mergePresences(
      shared,
      [{ ...other, at: NOW + PRESENCE_HEARTBEAT_MS * 2 }],
      NOW + PRESENCE_HEARTBEAT_MS * 2,
    )

    const later = NOW + PRESENCE_HEARTBEAT_MS * 2
    assert.equal(hasOtherTabOnDraft(shared, 'tab-mine', 'local-a', later), true)
    assert.equal(hasOtherTabOnDraft(shared, 'tab-other', 'local-a', later), true)
  })

  it('ignores our own presence, a different draft, and a heartbeat older than the TTL', () => {
    const shared = mergePresences(
      [],
      [
        presence({ tabId: 'tab-mine', at: NOW }),
        presence({ tabId: 'tab-other-draft', draftId: 'local-b', at: NOW }),
        presence({ tabId: 'tab-stale', at: NOW - PRESENCE_TTL_MS - 1 }),
      ],
      NOW,
    )
    assert.equal(hasOtherTabOnDraft(shared, 'tab-mine', 'local-a', NOW), false)
  })

  it('hides as soon as the other tab leaves, without waiting for the TTL', () => {
    const open = mergePresences([], [presence(), presence({ tabId: 'tab-mine' })], NOW)
    assert.equal(hasOtherTabOnDraft(open, 'tab-mine', 'local-a', NOW), true)

    const afterLeave = mergePresences(open, [{ tabId: 'tab-other', draftId: null, at: NOW, left: true }], NOW)
    assert.equal(hasOtherTabOnDraft(afterLeave, 'tab-mine', 'local-a', NOW), false)
  })
})
