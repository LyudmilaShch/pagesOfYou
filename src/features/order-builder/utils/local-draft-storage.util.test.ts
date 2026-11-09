import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LocalDraftStorageError,
  readLocalDraft,
  readLocalDrafts,
  removeLocalDraft,
  saveLocalDraft,
} from './local-draft-storage.util.ts'
import type { OrderDetail } from '../types/order.types'

function installMemoryStorage(options?: { failSet?: boolean }): Map<string, string> {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options?.failSet) {
        throw new Error('quota')
      }
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  return store
}

function order(id: string): OrderDetail {
  return { id, journalPages: [], questionAnswers: [] } as unknown as OrderDetail
}

describe('several guest drafts', () => {
  it('keeps each journal and its gallery token', () => {
    const store = installMemoryStorage()
    saveLocalDraft('type-a', order('local-a'), [], 'gallery-a')
    saveLocalDraft('type-b', order('local-b'), [], 'gallery-b')

    const drafts = readLocalDrafts()
    assert.deepEqual(
      drafts.map((draft) => [draft.id, draft.galleryGuestId]).sort(),
      [
        ['local-a', 'gallery-a'],
        ['local-b', 'gallery-b'],
      ],
    )
    assert.equal(store.get('pagesOfYou.localDrafts')?.includes('local-a'), true)

    removeLocalDraft('local-a')
    assert.equal(readLocalDraft('local-a'), null)
    assert.equal(readLocalDraft('local-b')?.galleryGuestId, 'gallery-b')
  })

  it('moves a legacy single draft into the list', () => {
    const store = installMemoryStorage()
    store.set(
      'pagesOfYou.localDraft',
      JSON.stringify({
        schemaVersion: 1,
        magazineTypeId: 'type-a',
        order: order('local-a'),
        galleryGuestId: 'gallery-a',
        savedAt: new Date().toISOString(),
      }),
    )

    const drafts = readLocalDrafts()
    assert.equal(drafts.length, 1)
    assert.equal(drafts[0].galleryGuestId, 'gallery-a')
    assert.equal(store.has('pagesOfYou.localDraft'), false)
  })

  it('drops only the draft that is older than 14 days', () => {
    const store = installMemoryStorage()
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    store.set(
      'pagesOfYou.localDrafts',
      JSON.stringify([
        {
          id: 'local-old',
          schemaVersion: 1,
          magazineTypeId: 'type-a',
          order: order('local-old'),
          galleryGuestId: 'gallery-old',
          savedAt: old,
        },
        {
          id: 'local-new',
          schemaVersion: 1,
          magazineTypeId: 'type-b',
          order: order('local-new'),
          galleryGuestId: 'gallery-new',
          savedAt: new Date().toISOString(),
        },
      ]),
    )

    const drafts = readLocalDrafts()
    assert.deepEqual(drafts.map((draft) => draft.id), ['local-new'])
  })

  it('reports that the draft cannot be saved when storage rejects the write', () => {
    installMemoryStorage({ failSet: true })
    assert.throws(() => saveLocalDraft('type-a', order('local-a'), [], 'gallery-a'), LocalDraftStorageError)
  })
})
