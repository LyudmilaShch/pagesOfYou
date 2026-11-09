import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createGuestGalleryId,
  galleryIdForRestoredDraft,
  resolvePhotoGalleryScope,
} from './guest-gallery.util.ts'
import { readLocalDraft, saveLocalDraft } from './local-draft-storage.util.ts'
import type { OrderDetail } from '../types/order.types'

const LEGACY_GUEST_ID = 'legacy-browser-guest'

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
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

describe('guest photo gallery scope', () => {
  it('gives a new guest journal its own gallery, not the previous journal or the browser guest id', () => {
    const firstJournalGalleryId = createGuestGalleryId()
    const secondJournalGalleryId = createGuestGalleryId()

    assert.notEqual(firstJournalGalleryId, secondJournalGalleryId)
    assert.notEqual(secondJournalGalleryId, LEGACY_GUEST_ID)

    const first = resolvePhotoGalleryScope({
      orderId: 'local-magazine',
      isLocalDraft: true,
      guestGalleryId: firstJournalGalleryId,
      legacyGuestId: LEGACY_GUEST_ID,
    })
    const second = resolvePhotoGalleryScope({
      orderId: 'local-magazine',
      isLocalDraft: true,
      guestGalleryId: secondJournalGalleryId,
      legacyGuestId: LEGACY_GUEST_ID,
    })

    assert.deepEqual(first, { guestId: firstJournalGalleryId })
    assert.deepEqual(second, { guestId: secondJournalGalleryId })
  })

  it('keeps the same gallery when that guest draft is restored', () => {
    const galleryId = createGuestGalleryId()

    assert.equal(
      galleryIdForRestoredDraft(galleryId, LEGACY_GUEST_ID),
      galleryId,
    )
    assert.deepEqual(
      resolvePhotoGalleryScope({
        orderId: 'local-magazine',
        isLocalDraft: true,
        guestGalleryId: galleryIdForRestoredDraft(galleryId, LEGACY_GUEST_ID),
        legacyGuestId: LEGACY_GUEST_ID,
      }),
      { guestId: galleryId },
    )
  })

  it('still restores a draft saved before galleries were per-journal', () => {
    assert.equal(
      galleryIdForRestoredDraft(undefined, LEGACY_GUEST_ID),
      LEGACY_GUEST_ID,
    )
    assert.equal(
      galleryIdForRestoredDraft('   ', LEGACY_GUEST_ID),
      LEGACY_GUEST_ID,
    )
    assert.deepEqual(
      resolvePhotoGalleryScope({
        orderId: 'local-magazine',
        isLocalDraft: true,
        guestGalleryId: null,
        legacyGuestId: LEGACY_GUEST_ID,
      }),
      { guestId: LEGACY_GUEST_ID },
    )
  })

  it('scopes a signed-in order to that order, so a new order does not inherit another gallery', () => {
    const previousGuestGalleryId = createGuestGalleryId()

    assert.deepEqual(
      resolvePhotoGalleryScope({
        orderId: 'order-new',
        isLocalDraft: false,
        guestGalleryId: previousGuestGalleryId,
        legacyGuestId: LEGACY_GUEST_ID,
      }),
      { orderId: 'order-new' },
    )
  })

  it('stores the gallery token on the guest draft and reads it back', () => {
    installMemoryStorage()
    const galleryId = createGuestGalleryId()
    const order = {
      id: 'local-magazine',
      journalPages: [],
      questionAnswers: [],
    } as unknown as OrderDetail

    saveLocalDraft('magazine', order, [], galleryId)

    assert.equal(readLocalDraft()?.galleryGuestId, galleryId)
  })
})
