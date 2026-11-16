import { describe, expect, it } from 'vitest'

import type { JournalPage, QuestionAnswer } from '../types/order.types'
import { syncAnswersOntoJournalPages } from './sync-answers-to-placeholders.util'

function listRow(id: string, order: number, questionKey: string) {
  return {
    id,
    type: 'text-placeholder',
    name: id,
    position: { x: 10, y: 20 + order * 40 },
    size: { width: 200, height: 30 },
    listId: 'wishes',
    listOrder: order,
    list: { questionKey, mode: 'start', heightMode: 'fixed' },
    listRole: 'item',
    questionKey,
    defaultText: `Пункт ${order + 1}`,
  }
}

function page(rows: ReturnType<typeof listRow>[]): JournalPage {
  return {
    id: 'page-1',
    sortOrder: 1,
    slotType: 'SPREAD',
    pageSnapshot: {
      version: 2,
      pageWidth: 1190,
      pageHeight: 842,
      elements: rows,
    },
    placeholderValues: [],
  } as unknown as JournalPage
}

const answer: QuestionAnswer = {
  questionKey: 'wishes',
  textValue: 'Море\nГоры',
  jsonValue: { items: ['Море', 'Горы'] },
}

describe('syncAnswersOntoJournalPages', () => {
  it('writes each list item onto its row instead of leaving the template stub', () => {
    const journal = page([listRow('row-a', 0, 'wishes'), listRow('row-b', 1, 'wishes')])

    syncAnswersOntoJournalPages([journal], [answer], ['wishes'])

    const text = new Map(journal.placeholderValues.map((value) => [value.elementId, value.textValue]))
    expect(text.get('row-a')).toBe('Море')
    expect(text.get('row-b')).toBe('Горы')
  })

  it('continues the list on the next page', () => {
    const first = page([listRow('row-a', 0, 'wishes'), listRow('row-b', 1, 'wishes')])
    const second = {
      ...page([listRow('row-c', 0, 'wishes')]),
      id: 'page-2',
    }
    const three: QuestionAnswer = {
      questionKey: 'wishes',
      textValue: 'Море\nГоры\nЛес',
      jsonValue: { items: ['Море', 'Горы', 'Лес'] },
    }

    syncAnswersOntoJournalPages([first, second], [three], ['wishes'])

    expect(second.placeholderValues[0]?.textValue).toBe('Лес')
  })

  it('keeps a hand-edited row', () => {
    const journal = page([listRow('row-a', 0, 'wishes')])
    journal.placeholderValues = [
      {
        id: 'hand',
        elementId: 'row-a',
        valueType: 'TEXT',
        textValue: 'Своими словами',
        jsonValue: null,
        source: 'OVERRIDDEN',
      },
    ]

    syncAnswersOntoJournalPages([journal], [answer], ['wishes'])

    expect(journal.placeholderValues[0]?.textValue).toBe('Своими словами')
  })
})
