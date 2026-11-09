import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { stripPhotoUrlFromJournalPages } from './strip-photo-url.util.ts'
import type { JournalPage } from '../types/order.types'

function page(): JournalPage {
  return {
    id: 'page-1',
    sortOrder: 0,
    slotType: 'SPREAD',
    layoutMode: 'SPREAD',
    magazinePage: { id: 'tpl', name: 'Разворот', pageType: 'SPREAD', previewImage: null, isRequired: false },
    placeholderValues: [
      {
        id: 'v1',
        elementId: 'slot-1',
        valueType: 'PHOTO',
        textValue: null,
        jsonValue: { url: 'https://cdn.example/uploads/a.jpg' },
        source: 'OVERRIDDEN',
      },
      {
        id: 'v2',
        elementId: 'slot-2',
        valueType: 'PHOTO',
        textValue: null,
        jsonValue: { url: 'https://cdn.example/uploads/b.jpg' },
        source: 'OVERRIDDEN',
      },
    ],
    pageSnapshot: {
      version: 2,
      elements: [
        { id: 'slot-1', type: 'photo-placeholder', defaultImageUrl: '/uploads/a.jpg' },
        { id: 'slot-2', type: 'photo-placeholder', defaultImageUrl: '/uploads/b.jpg' },
      ],
    },
  } as unknown as JournalPage
}

describe('stripPhotoUrlFromJournalPages', () => {
  it('removes the deleted photo from slots and leaves the other photo', () => {
    const result = stripPhotoUrlFromJournalPages([page()], 'https://cdn.example/uploads/a.jpg')
    const [updated] = result.pages
    assert.equal(result.changed, true)
    assert.deepEqual(
      updated.placeholderValues.map((value) => value.jsonValue?.url),
      ['https://cdn.example/uploads/b.jpg'],
    )
    const urls = (updated.pageSnapshot.elements as Array<{ defaultImageUrl?: string | null }>).map(
      (element) => element.defaultImageUrl,
    )
    assert.deepEqual(urls, [null, '/uploads/b.jpg'])
    assert.deepEqual(result.clearedPlaceholderElementIdsByPageId, [
      { pageId: 'page-1', elementIds: ['slot-1'] },
    ])
  })
})
