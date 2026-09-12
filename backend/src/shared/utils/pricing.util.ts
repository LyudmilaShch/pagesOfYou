export interface JournalSpreadPricing {
  // `unknown` rather than `string | number | null` so a Prisma `Decimal` (which `Number()`
  // coerces correctly via its own `toString()`) can be passed straight through without callers
  // needing to convert it first.
  basePrice: unknown;
  includedSpreads: number;
  pricePerExtraFourPages: unknown;
}

/** Front + back cover together count as one spread's worth of pages for pricing purposes — same
 * unit `includedSpreads` is expressed in (an admin setting `includedSpreads = 10` means "10
 * spreads total, cover included", not "10 interior spreads plus a cover on top"). */
const COVER_SPREAD_EQUIVALENT = 1;

export interface JournalPriceBreakdown {
  basePrice: number;
  /** Total pages the base price covers — admin sets `includedSpreads` as the total number of
   * spreads the base price is meant to cover (cover pages included in that count, not added on
   * top), so this is simply `includedSpreads * 2`. */
  includedPages: number;
  /** Pages beyond includedPages, billed — always a multiple of 4 (whole extraPagesPrice units). */
  extraPages: number;
  /** What those extra pages cost, in total. */
  extraPagesPrice: number;
  total: number;
}

/** `spreadCount` (from `countSpreadSlots`) counts only interior SPREAD slots — the cover is added
 * back in here (`+ COVER_SPREAD_EQUIVALENT`) before comparing against `includedSpreads`, since
 * that threshold is expressed in "total spreads including cover" terms, not interior-only.
 * Interior spreads are always odd (`MIN_JOURNAL_SPREADS`, `OrdersService.addJournalSpread` only
 * ever adds pairs), so `spreadCount + 1` is always even, and `includedSpreads` is validated even
 * too (`AdminMagazineTypesService.assertEvenIncludedSpreads`) — their difference is therefore
 * always a whole number of 4-page units with nothing left over; `Math.floor` is just a defensive
 * floor for any data that predates these invariants. */
export function calculateJournalPriceBreakdown(
  pricing: JournalSpreadPricing,
  spreadCount: number,
): JournalPriceBreakdown {
  const basePrice = Number(pricing.basePrice ?? 0);
  const perFourPages = Number(pricing.pricePerExtraFourPages ?? 0);
  const totalSpreadEquivalents = spreadCount + COVER_SPREAD_EQUIVALENT;
  const extraSpreadEquivalents = Math.max(0, totalSpreadEquivalents - pricing.includedSpreads);
  const extraFourPageUnits = Math.floor(extraSpreadEquivalents / 2);
  const extraPages = extraFourPageUnits * 4;
  const extraPagesPrice = extraFourPageUnits * perFourPages;
  const includedPages = pricing.includedSpreads * 2;

  return {
    basePrice,
    includedPages,
    extraPages,
    extraPagesPrice,
    total: basePrice + extraPagesPrice,
  };
}

/** Recomputed on order creation and every time spreads are added, so `Order.totalPrice` always
 * reflects the journal's actual current size. */
export function calculateJournalPrice(pricing: JournalSpreadPricing, spreadCount: number): number {
  return calculateJournalPriceBreakdown(pricing, spreadCount).total;
}
