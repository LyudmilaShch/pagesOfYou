import { pluralize } from '@/shared/utils/pluralize.util'

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

export function formatRub(value: number): string {
  return `${priceFormatter.format(value)} ₽`
}

/** What the next spread costs: the layout-only add-on, or that plus print.
 * Null while the click is still inside the base journal or both extras are free. */
export function spreadPriceNote(layoutDelta: number, printDelta: number): string | null {
  const layout = Math.max(0, layoutDelta)
  const print = Math.max(0, printDelta)
  if (layout === 0 && print === 0) {
    return null
  }
  if (layout > 0 && print > 0) {
    return `+${formatRub(layout)} или +${formatRub(layout + print)} с печатью`
  }
  if (print > 0) {
    return `+${formatRub(print)} с печатью`
  }
  return `+${formatRub(layout)}`
}

export interface PriceTooltip {
  layout: string
  print: string
  together: string
  extraText: string
}

/** How much extra spreads added to the layout and to the print. */
function extraParts(layoutPrice: number, printPrice: number): string | null {
  const parts: string[] = []
  if (layoutPrice > 0) {
    parts.push(`макет +${formatRub(layoutPrice)}`)
  }
  if (printPrice > 0) {
    parts.push(`печать +${formatRub(printPrice)}`)
  }
  return parts.length > 0 ? parts.join(', ') : null
}

/** Tooltip under the header price. The two header numbers come first; extras are one sentence. */
export function priceTooltip(quote: {
  layoutBase: number
  printFrom: number
  extraSpreads: number
  extraLayoutPrice: number
  extraPrintPrice: number
}): PriceTooltip {
  const layoutTotal = quote.layoutBase + quote.extraLayoutPrice
  const parts = extraParts(quote.extraLayoutPrice, quote.extraPrintPrice)
  let extraText = 'Дополнительных разворотов нет.'
  if (quote.extraSpreads > 0) {
    const noun = pluralize(quote.extraSpreads, 'разворот', 'разворота', 'разворотов')
    const verb = quote.extraSpreads % 10 === 1 && quote.extraSpreads % 100 !== 11 ? 'Добавлен' : 'Добавлено'
    extraText = parts
      ? `${verb} ${quote.extraSpreads} ${noun}: ${parts}.`
      : `${verb} ${quote.extraSpreads} ${noun}.`
  }
  return {
    layout: formatRub(layoutTotal),
    print: formatRub(quote.printFrom),
    together: formatRub(layoutTotal + quote.printFrom),
    extraText,
  }
}

/** Label of the add-pages control. */
export function addPagesButtonLabel(layoutDelta: number, printDelta: number): string {
  const note = spreadPriceNote(layoutDelta, printDelta)
  return note ? `Добавить 4 страницы · ${note}` : 'Добавить 4 страницы'
}
