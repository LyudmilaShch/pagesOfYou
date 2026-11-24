export type OrderFulfillmentChoice = 'LAYOUT' | 'PRINT';

export interface JournalSpreadPricing {
  layoutPrice?: unknown;
  printPrice?: unknown;
  layoutPricePerExtraSpread?: unknown;
  printPricePerExtraSpread?: unknown;
  includedSpreads: number;
  /** Legacy single price. Used only when `layoutPrice` is absent. */
  basePrice?: unknown;
  pricePerExtraFourPages?: unknown;
}

/** Front + back cover together count as one spread for the included-spreads budget. */
const COVER_SPREAD_EQUIVALENT = 1;

export interface JournalQuote {
  layoutBase: number;
  printFrom: number;
  withPrintFrom: number;
  extraSpreads: number;
  extraLayoutPrice: number;
  extraPrintPrice: number;
  layoutTotal: number;
  withPrintTotal: number;
  printPerExtraSpread: number;
  nextSpreadLayoutDelta: number;
  nextSpreadPrintDelta: number;
}

function money(value: unknown, fallback = 0): number {
  if (value == null || value === '') {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Spreads beyond what `includedSpreads` already covers. `spreadCount` is interior slots
 * (`countSpreadSlots`); the cover is added back before the comparison. */
export function countExtraSpreads(spreadCount: number, includedSpreads: number): number {
  return Math.max(0, spreadCount + COVER_SPREAD_EQUIVALENT - includedSpreads);
}

export function quoteJournal(pricing: JournalSpreadPricing, spreadCount: number): JournalQuote {
  const layoutBase = money(pricing.layoutPrice, money(pricing.basePrice));
  const printBase = money(pricing.printPrice);
  const layoutPer = money(pricing.layoutPricePerExtraSpread);
  const printPer = money(pricing.printPricePerExtraSpread);
  const extraSpreads = countExtraSpreads(spreadCount, pricing.includedSpreads);
  const extraLayoutPrice = extraSpreads * layoutPer;
  const extraPrintPrice = extraSpreads * printPer;
  const printFrom = printBase + extraPrintPrice;
  const nextExtra = countExtraSpreads(spreadCount + 1, pricing.includedSpreads);
  const nextSpreadLayoutDelta = Math.max(0, nextExtra * layoutPer - extraLayoutPrice);
  const nextSpreadPrintDelta = Math.max(0, nextExtra * printPer - extraPrintPrice);

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
  };
}

/** Stored order total. Until the customer picks a variant, this is the exact with-print sum. */
export function calculateJournalPrice(
  pricing: JournalSpreadPricing,
  spreadCount: number,
  fulfillment: OrderFulfillmentChoice | null = null,
): number {
  const quote = quoteJournal(pricing, spreadCount);
  return fulfillment === 'LAYOUT' ? quote.layoutTotal : quote.withPrintTotal;
}
