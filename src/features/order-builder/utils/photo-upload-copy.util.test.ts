import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  COVER_GALLERY_BANNER,
  COVER_ORIENTATION_BADGE,
  COVER_PICK_TOOLTIP,
  photoUploadIntro,
} from './photo-upload-copy.util.ts'

describe('photo upload intro', () => {
  it('declines the photo noun for 1, 3, 5 and 11', () => {
    assert.match(photoUploadIntro(1), /^Загрузите 1 фотографию /)
    assert.match(photoUploadIntro(3), /^Загрузите 3 фотографии /)
    assert.match(photoUploadIntro(5), /^Загрузите 5 фотографий /)
    assert.match(photoUploadIntro(11), /^Загрузите 11 фотографий /)
    assert.match(photoUploadIntro(21), /^Загрузите 21 фотографию /)
  })

  it('drops the number once every customer slot is filled', () => {
    const text = photoUploadIntro(0)
    assert.match(text, /^Фото расставлены\./)
    assert.equal(text.includes('Загрузите'), false)
    assert.equal(text.includes('0'), false)
  })
})

describe('cover photo hints', () => {
  it('keeps the short hover line, the gallery banner, and the landscape warning distinct', () => {
    assert.match(COVER_PICK_TOOLTIP, /вертикальное фото со спокойным фоном/)
    assert.match(COVER_GALLERY_BANNER, /хорошем качестве/)
    assert.match(COVER_GALLERY_BANNER, /Горизонтальный снимок на обложке сильно обрежется/)
    assert.equal(COVER_ORIENTATION_BADGE, 'Для обложки лучше вертикальное фото.')
  })
})
