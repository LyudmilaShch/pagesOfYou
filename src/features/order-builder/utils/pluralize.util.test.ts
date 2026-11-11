import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pluralize } from '../../../shared/utils/pluralize.util.ts'

const photo = (n: number) => pluralize(n, 'фотографию', 'фотографии', 'фотографий')

describe('pluralize', () => {
  it('uses the singular accusative for 1, 21, 31', () => {
    assert.equal(photo(1), 'фотографию')
    assert.equal(photo(21), 'фотографию')
    assert.equal(photo(101), 'фотографию')
  })

  it('uses the few form for 2–4, but not for 12–14', () => {
    assert.equal(photo(2), 'фотографии')
    assert.equal(photo(3), 'фотографии')
    assert.equal(photo(4), 'фотографии')
    assert.equal(photo(22), 'фотографии')
    assert.equal(photo(12), 'фотографий')
    assert.equal(photo(14), 'фотографий')
  })

  it('uses the many form for 0, 5–20 and 11, 111', () => {
    assert.equal(photo(0), 'фотографий')
    assert.equal(photo(5), 'фотографий')
    assert.equal(photo(11), 'фотографий')
    assert.equal(photo(19), 'фотографий')
    assert.equal(photo(111), 'фотографий')
  })
})
