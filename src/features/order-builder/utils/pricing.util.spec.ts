import { describe, expect, it } from 'vitest'

import { addPagesButtonLabel, formatRub, priceTooltip } from './price-copy.util'
import { calculateJournalPrice, quoteJournal } from './pricing.util'

const pricing = {
  layoutPrice: 1490,
  printPrice: 1800,
  layoutPricePerExtraSpread: 100,
  printPricePerExtraSpread: 300,
  includedSpreads: 8,
}

describe('quoteJournal', () => {
  it('shows the base layout and print-from before any extra spreads', () => {
    const quote = quoteJournal(pricing, 7)

    expect(quote.layoutBase).toBe(1490)
    expect(quote.printFrom).toBe(1800)
    expect(quote.withPrintFrom).toBe(3290)
    expect(quote.extraSpreads).toBe(0)
    expect(quote.layoutTotal).toBe(1490)
    expect(quote.withPrintTotal).toBe(3290)
    expect(quote.nextSpreadLayoutDelta).toBe(100)
    expect(quote.nextSpreadPrintDelta).toBe(300)
  })

  it('keeps the layout header price fixed and grows only the print price', () => {
    const quote = quoteJournal(pricing, 9)

    expect(quote.extraSpreads).toBe(2)
    expect(quote.layoutBase).toBe(1490)
    expect(quote.printFrom).toBe(2400)
    expect(quote.withPrintFrom).toBe(3890)
    expect(quote.extraPrintPrice).toBe(600)
    expect(quote.layoutTotal).toBe(1690)
    expect(quote.withPrintTotal).toBe(4090)
  })

  it('does not charge the next spread while it is still inside the base journal', () => {
    const quote = quoteJournal(pricing, 5)
    expect(quote.nextSpreadLayoutDelta).toBe(0)
    expect(quote.nextSpreadPrintDelta).toBe(0)
    expect(quote.extraSpreads).toBe(0)
  })

  it('falls back to the legacy base price when the layout price is unset', () => {
    const quote = quoteJournal({ includedSpreads: 8, basePrice: 2000 }, 7)
    expect(quote.layoutBase).toBe(2000)
    expect(quote.printFrom).toBe(0)
  })

  it('stores the with-print total until a layout-only choice', () => {
    expect(calculateJournalPrice(pricing, 9)).toBe(4090)
    expect(calculateJournalPrice(pricing, 9, 'LAYOUT')).toBe(1690)
    expect(calculateJournalPrice(pricing, 9, 'PRINT')).toBe(4090)
  })
})

describe('price copy', () => {
  it('shows the layout-only price or the price with print', () => {
    expect(addPagesButtonLabel(0, 0)).toBe('Добавить 4 страницы')
    expect(addPagesButtonLabel(50, 300)).toBe('Добавить 4 страницы · +50 ₽ или +350 ₽ с печатью')
    expect(addPagesButtonLabel(50, 0)).toBe('Добавить 4 страницы · +50 ₽')
    expect(addPagesButtonLabel(0, 300)).toBe('Добавить 4 страницы · +300 ₽ с печатью')
  })

  it('splits the base price from extra spreads in the tooltip', () => {
    const base = priceTooltip(quoteJournal(pricing, 7))
    expect(base.layout).toBe(formatRub(1490))
    expect(base.print).toBe(formatRub(1800))
    expect(base.together).toBe(formatRub(3290))
    expect(base.extraText).toBe('Дополнительных разворотов нет.')

    const extra = priceTooltip(quoteJournal(pricing, 9))
    expect(extra.layout).toBe(formatRub(1690))
    expect(extra.print).toBe(formatRub(2400))
    expect(extra.together).toBe(formatRub(4090))
    expect(extra.extraText).toBe(
      `Добавлено 2 разворота: макет +${formatRub(200)}, печать +${formatRub(600)}.`,
    )
  })
})
