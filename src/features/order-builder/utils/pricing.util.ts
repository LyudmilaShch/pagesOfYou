export type OrderFulfillmentChoice = 'LAYOUT' | 'PRINT'

export interface JournalSpreadPricing {
  /** PDF layout for the base journal. Falls back to `basePrice` when unset. Decimal fields arrive as strings. */
  layoutPrice?: unknown
  /** Print for the base journal — the header's «печать от» before any extras. */
  printPrice?: unknown
  /** Added to the layout total for every spread beyond `includedSpreads`. */
  layoutPricePerExtraSpread?: unknown
  /** Added to the print «от» price for every spread beyond `includedSpreads`. */
  printPricePerExtraSpread?: unknown
  includedSpreads: number
  /** Legacy single price. Used only when `layoutPrice` is absent. */
  basePrice?: unknown
  pricePerExtraFourPages?: unknown
}

/** Front + back cover together count as one spread for the included-spreads budget. */
const COVER_SPREAD_EQUIVALENT = 1

export interface JournalQuote {
  /** Layout price of the base journal, before extra spreads. */
  layoutBase: number
  /** Base print plus extra spreads × print extra. */
  printFrom: number
  /** Layout base plus print base and extra print. Does not include extra layout. */
  withPrintFrom: number
  extraSpreads: number
  extraLayoutPrice: number
  extraPrintPrice: number
  /** Exact «Только макет» on the last step. */
  layoutTotal: number
  /** Exact «С печатью» on the last step. */
  withPrintTotal: number
  /** Configured print price of one extra spread. 0 hides the price on the add button. */
  printPerExtraSpread: number
  /** What the next added spread adds to the layout price (0 while still inside the base). */
  nextSpreadLayoutDelta: number
  /** What the next added spread adds to the print price (0 while still inside the base). */
  nextSpreadPrintDelta: number
}

/** Prefer the freshly loaded catalog type over a draft snapshot that may predate a price change. */
export function resolveActivePricing(
  orderType: (JournalSpreadPricing & { id?: string }) | null | undefined,
  selected: (JournalSpreadPricing & { id?: string }) | null | undefined,
  orderTypeId?: string | null,
): JournalSpreadPricing | null {
  if (selected && (!orderTypeId || selected.id === orderTypeId)) {
    return selected
  }
  return orderType ?? selected ?? null
}

function money(value: unknown, fallback = 0): number {
  if (value == null || value === '') {
    return fallback
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Spreads beyond what `includedSpreads` already covers. `spreadCount` is interior slots
 * (`countSpreadSlots`); the cover is added back before the comparison. */
export function countExtraSpreads(spreadCount: number, includedSpreads: number): number {
  return Math.max(0, spreadCount + COVER_SPREAD_EQUIVALENT - includedSpreads)
}

export function quoteJournal(pricing: JournalSpreadPricing, spreadCount: number): JournalQuote {
  const layoutBase = money(pricing.layoutPrice, money(pricing.basePrice))
  const printBase = money(pricing.printPrice)
  const layoutPer = money(pricing.layoutPricePerExtraSpread)
  const printPer = money(pricing.printPricePerExtraSpread)
  const extraSpreads = countExtraSpreads(spreadCount, pricing.includedSpreads)
  const extraLayoutPrice = extraSpreads * layoutPer
  const extraPrintPrice = extraSpreads * printPer
  const printFrom = printBase + extraPrintPrice
  const nextExtra = countExtraSpreads(spreadCount + 1, pricing.includedSpreads)
  const nextSpreadLayoutDelta = Math.max(0, nextExtra * layoutPer - extraLayoutPrice)
  const nextSpreadPrintDelta = Math.max(0, nextExtra * printPer - extraPrintPrice)

  return {
    layoutBase,
    printFrom,
    withPrintFrom: layoutBase + printFrom,
    extraSpreads,
    extraLayoutPrice,
    extraPrintPrice,
    layoutTotal: layoutBase + extraLayoutPrice,
    withPrintTotal: layoutBase + extraLayoutPrice + printFrom,
    printPerExtraSpread: printPer,
    nextSpreadLayoutDelta,
    nextSpreadPrintDelta,
  }
}

/** Stored order total. Until the customer picks a variant, this is the exact with-print sum. */
export function calculateJournalPrice(
  pricing: JournalSpreadPricing,
  spreadCount: number,
  fulfillment: OrderFulfillmentChoice | null = null,
): number {
  const quote = quoteJournal(pricing, spreadCount)
  return fulfillment === 'LAYOUT' ? quote.layoutTotal : quote.withPrintTotal
}

/** @deprecated Shape kept so older call sites that only read the lump sum still compile.
 * New UI should use `quoteJournal`. */
export interface JournalPriceBreakdown {
  basePrice: number
  includedPages: number
  extraPages: number
  extraPagesPrice: number
  total: number
}

export function calculateJournalPriceBreakdown(
  pricing: JournalSpreadPricing,
  spreadCount: number,
): JournalPriceBreakdown {
  const quote = quoteJournal(pricing, spreadCount)
  return {
    basePrice: quote.layoutBase,
    includedPages: pricing.includedSpreads * 2,
    extraPages: quote.extraSpreads * 2,
    extraPagesPrice: quote.extraLayoutPrice + quote.extraPrintPrice,
    total: quote.withPrintTotal,
  }
}
