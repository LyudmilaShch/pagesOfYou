import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canAutoPlaceCustomerPhoto,
  collectAutoFillTargets,
  collectMissingPhotoPages,
  countPhotosCustomerSupplies,
  isCustomerPhotoSlotFilled,
  missingPhotoLine,
  missingPhotoPill,
  shouldHideCoverAdminImage,
  type CustomerPhotoFact,
} from './photo-slot-rules.util.ts'

function fact(overrides: Partial<CustomerPhotoFact> & Pick<CustomerPhotoFact, 'slotType'>): CustomerPhotoFact {
  return {
    pageId: 'page-1',
    pageLabel: overrides.slotType === 'COVER' ? 'Обложка' : 'Разворот 1',
    elementId: 'slot',
    slotLabel: 'Фото',
    questionKey: null,
    adminImageUrl: null,
    userUrl: null,
    ...overrides,
  }
}

describe('customer photo slots', () => {
  it('treats an admin image on the cover as an empty slot', () => {
    const cover = fact({
      slotType: 'COVER',
      pageLabel: 'Обложка',
      adminImageUrl: '/uploads/sample.jpg',
    })
    assert.equal(isCustomerPhotoSlotFilled(cover), false)
    assert.equal(shouldHideCoverAdminImage(cover), true)
    assert.equal(canAutoPlaceCustomerPhoto(cover), false)
  })

  it('treats a customer photo on the cover as filled and visible', () => {
    const cover = fact({
      slotType: 'COVER',
      pageLabel: 'Обложка',
      adminImageUrl: '/uploads/sample.jpg',
      userUrl: '/uploads/mine.jpg',
    })
    assert.equal(isCustomerPhotoSlotFilled(cover), true)
    assert.equal(shouldHideCoverAdminImage(cover), false)
  })

  it('treats an admin image on a spread as filled', () => {
    const spread = fact({ slotType: 'SPREAD', adminImageUrl: '/uploads/sample.jpg' })
    assert.equal(isCustomerPhotoSlotFilled(spread), true)
    assert.equal(canAutoPlaceCustomerPhoto(spread), false)
    assert.equal(shouldHideCoverAdminImage(spread), false)
  })

  it('leaves a spread slot empty when nobody supplied a photo', () => {
    const spread = fact({ slotType: 'SPREAD' })
    assert.equal(isCustomerPhotoSlotFilled(spread), false)
    assert.equal(canAutoPlaceCustomerPhoto(spread), true)
  })

  it('ignores anketa-owned slots', () => {
    const anketa = fact({ slotType: 'SPREAD', questionKey: 'hero-photo' })
    assert.equal(isCustomerPhotoSlotFilled(anketa), true)
    assert.equal(canAutoPlaceCustomerPhoto(anketa), false)
    const pages = collectMissingPhotoPages([anketa])
    assert.deepEqual(pages, [])
  })

  it('asks for the cover even when every other slot is already closed', () => {
    const journal = [
      fact({
        pageId: 'cover',
        elementId: 'cover',
        slotType: 'COVER',
        adminImageUrl: '/uploads/sample.jpg',
      }),
      fact({
        pageId: 'spread',
        elementId: 'admin',
        slotType: 'SPREAD',
        adminImageUrl: '/uploads/kept.jpg',
      }),
      fact({
        pageId: 'spread',
        elementId: 'placed',
        slotType: 'SPREAD',
        userUrl: '/uploads/mine.jpg',
      }),
      fact({
        pageId: 'spread',
        elementId: 'anketa',
        slotType: 'SPREAD',
        questionKey: 'hero',
      }),
    ]
    assert.equal(countPhotosCustomerSupplies(journal), 2)
    assert.equal(collectMissingPhotoPages(journal).reduce((sum, page) => sum + page.slots.length, 0), 1)
  })

  it('grows when a spread with empty slots is added and shrinks when that spread is removed', () => {
    const base = [
      fact({ pageId: 'cover', elementId: 'cover', slotType: 'COVER' }),
      fact({ pageId: 'spread-1', elementId: 'a', slotType: 'SPREAD', userUrl: '/uploads/a.jpg' }),
    ]
    const added = [
      ...base,
      fact({ pageId: 'spread-2', elementId: 'empty-1', slotType: 'SPREAD' }),
      fact({ pageId: 'spread-2', elementId: 'empty-2', slotType: 'SPREAD' }),
      fact({
        pageId: 'spread-2',
        elementId: 'admin',
        slotType: 'SPREAD',
        adminImageUrl: '/uploads/sample.jpg',
      }),
    ]
    assert.equal(countPhotosCustomerSupplies(base), 2)
    assert.equal(countPhotosCustomerSupplies(added), 4)
    assert.equal(countPhotosCustomerSupplies(base), 2)
  })

  it('lists the cover and a spread hole, and names them', () => {
    const pages = collectMissingPhotoPages([
      fact({
        pageId: 'cover',
        pageLabel: 'Обложка',
        elementId: 'cover-photo',
        slotType: 'COVER',
        adminImageUrl: '/uploads/sample.jpg',
      }),
      fact({
        pageId: 'spread-6',
        pageLabel: 'Разворот 6',
        elementId: 'a',
        slotType: 'SPREAD',
      }),
      fact({
        pageId: 'spread-6',
        pageLabel: 'Разворот 6',
        elementId: 'b',
        slotType: 'SPREAD',
        adminImageUrl: '/uploads/kept.jpg',
      }),
      fact({
        pageId: 'spread-6',
        pageLabel: 'Разворот 6',
        elementId: 'c',
        slotType: 'SPREAD',
      }),
    ])

    assert.deepEqual(
      pages.map((page) => missingPhotoLine(page.pageLabel, page.slots.length)),
      ['Обложка — фото не выбрано', 'Разворот 6 — 2 пустых места'],
    )
    assert.equal(missingPhotoPill(3), '3 фото не на месте')
    assert.equal(missingPhotoLine('Разворот 1', 1), 'Разворот 1 — 1 пустое место')
    assert.equal(missingPhotoLine('Разворот 2', 5), 'Разворот 2 — 5 пустых мест')
    assert.equal(missingPhotoLine('Разворот 3', 21), 'Разворот 3 — 21 пустое место')
  })

  it('auto-places spare photos only into new empty spread slots', () => {
    const facts = [
      fact({ pageId: 'cover', elementId: 'cover', slotType: 'COVER' }),
      fact({ pageId: 'old', elementId: 'old-empty', slotType: 'SPREAD' }),
      fact({ pageId: 'new', elementId: 'new-empty', slotType: 'SPREAD' }),
      fact({
        pageId: 'new',
        elementId: 'new-admin',
        slotType: 'SPREAD',
        adminImageUrl: '/uploads/sample.jpg',
      }),
      fact({
        pageId: 'new',
        elementId: 'new-anketa',
        slotType: 'SPREAD',
        questionKey: 'gallery',
      }),
    ]
    assert.deepEqual(collectAutoFillTargets(facts, new Set(['new'])), [
      { journalPageId: 'new', elementId: 'new-empty' },
    ])
  })
})
