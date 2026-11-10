import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  COVER_GALLERY_BANNER,
  COVER_LANDSCAPE_WARNING,
  COVER_ORIENTATION_BADGE,
  COVER_PICK_TOOLTIP,
  photoUploadIntro,
} from './photo-upload-copy.util.ts'

describe('photo upload intro', () => {
  it('uses the same hole count as the counter while slots are empty', () => {
    const text = photoUploadIntro(3)
    assert.match(text, /^Загрузите 3 фотографий/)
    assert.match(text, /автоматически расставим/)
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
    assert.match(COVER_LANDSCAPE_WARNING, /Лучше выбрать вертикальное/)
    assert.equal(
      COVER_ORIENTATION_BADGE,
      'Горизонтальное фото: на обложке кадр сильно обрежется.',
    )
  })
})
