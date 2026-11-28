import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { OrderDetail } from '../types/order.types'
import {
  ensureOrderForRoute,
  LOST_LOCAL_DRAFT_MESSAGE,
  type OrderRouteStore,
} from './ensure-order-for-route.util.ts'
import { saveLocalDraft, type StoredLocalDraft } from './local-draft-storage.util.ts'

function installMemoryStorage(): void {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

function order(id: string): OrderDetail {
  return { id, journalPages: [], questionAnswers: [] } as unknown as OrderDetail
}

function fakeStore(currentId: string | null = null): {
  store: OrderRouteStore
  restored: StoredLocalDraft[]
  loaded: string[]
} {
  const restored: StoredLocalDraft[] = []
  const loaded: string[] = []
  return {
    restored,
    loaded,
    store: {
      order: currentId ? { id: currentId } : null,
      loadOrder: async (orderId: string) => {
        loaded.push(orderId)
      },
      restoreLocalDraft: async (stored: StoredLocalDraft) => {
        restored.push(stored)
      },
    },
  }
}

describe('ensureOrderForRoute', () => {
  it('leaves an order that is already in the store', async () => {
    const { store, restored, loaded } = fakeStore('local-a')

    await ensureOrderForRoute('local-a', store)

    assert.deepEqual(restored, [])
    assert.deepEqual(loaded, [])
  })

  it('restores a guest draft from localStorage', async () => {
    installMemoryStorage()
    saveLocalDraft('type-a', order('local-a'), [], 'gallery-a')
    const { store, restored, loaded } = fakeStore()

    await ensureOrderForRoute('local-a', store)

    assert.equal(restored.length, 1)
    assert.equal(restored[0].id, 'local-a')
    assert.equal(restored[0].galleryGuestId, 'gallery-a')
    assert.deepEqual(loaded, [])
  })

  it('reports a guest draft that is no longer stored', async () => {
    installMemoryStorage()
    const { store, restored, loaded } = fakeStore()

    await assert.rejects(
      () => ensureOrderForRoute('local-missing', store),
      (err: unknown) => err instanceof Error && err.message === LOST_LOCAL_DRAFT_MESSAGE,
    )
    assert.deepEqual(restored, [])
    assert.deepEqual(loaded, [])
  })

  it('loads a server order by id', async () => {
    const { store, restored, loaded } = fakeStore()

    await ensureOrderForRoute('order-42', store)

    assert.deepEqual(restored, [])
    assert.deepEqual(loaded, ['order-42'])
  })
})
