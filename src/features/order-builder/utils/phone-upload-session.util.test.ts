import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  phoneUploadAbsoluteUrl,
  phoneUploadStorageKey,
  readStoredPhoneUploadSession,
  unseenPhotos,
} from './phone-upload-session.util.ts'

const NOW = Date.parse('2026-11-25T12:00:00.000Z')

describe('phone upload session storage', () => {
  it('keys a real order and a guest gallery separately', () => {
    assert.equal(phoneUploadStorageKey({ orderId: 'order-1' }), 'pagesOfYou.phoneUpload.order.order-1')
    assert.equal(phoneUploadStorageKey({ guestId: 'guest-1' }), 'pagesOfYou.phoneUpload.guest.guest-1')
  })

  it('builds a public upload URL from the current origin', () => {
    assert.equal(
      phoneUploadAbsoluteUrl('http://localhost:5173', '/', 'tok en'),
      'http://localhost:5173/phone-upload/tok%20en',
    )
    assert.equal(
      phoneUploadAbsoluteUrl('https://pagesofyou.ru/', '/journal/', 'abc'),
      'https://pagesofyou.ru/journal/phone-upload/abc',
    )
  })

  it('keeps a live session and forgets an expired one', () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => {
        memory.delete(key)
      },
    }
    const key = 'session'
    memory.set(
      key,
      JSON.stringify({
        uploadToken: 'up',
        revokeToken: 're',
        expiresAt: '2026-11-25T13:00:00.000Z',
      }),
    )

    assert.deepEqual(readStoredPhoneUploadSession(storage, key, NOW), {
      uploadToken: 'up',
      revokeToken: 're',
      expiresAt: '2026-11-25T13:00:00.000Z',
    })

    memory.set(
      key,
      JSON.stringify({
        uploadToken: 'up',
        revokeToken: 're',
        expiresAt: '2026-11-25T11:00:00.000Z',
      }),
    )
    assert.equal(readStoredPhoneUploadSession(storage, key, NOW), null)
    assert.equal(storage.getItem(key), null)
  })
})

describe('unseen gallery photos', () => {
  it('returns only new ids and keeps newest-first order', () => {
    const known = new Set(['a'])
    assert.deepEqual(
      unseenPhotos(
        [
          { id: 'c', url: 'c' },
          { id: 'a', url: 'a' },
          { id: 'b', url: 'b' },
        ],
        known,
      ),
      [
        { id: 'c', url: 'c' },
        { id: 'b', url: 'b' },
      ],
    )
  })
})
