export interface JournalSpreadPricing {
  basePrice: number | null
  includedSpreads: number
  pricePerExtraFourPages: number | null
}

/** Front + back cover together count as one spread's worth of pages for pricing purposes — same
 * unit `includedSpreads` is expressed in (an admin setting `includedSpreads = 10` means "10
 * spreads total, cover included", not "10 interior spreads plus a cover on top"). */
const COVER_SPREAD_EQUIVALENT = 1

export interface JournalPriceBreakdown {
  basePrice: number
  /** Total pages the base price covers — admin sets `includedSpreads` as the total number of
   * spreads the base price is meant to cover (cover pages included in that count, not added on
   * top), so this is simply `includedSpreads * 2`. */
  includedPages: number
  /** Pages beyond includedPages, billed — always a multiple of 4 (whole extraPagesPrice units). */
  extraPages: number
  /** What those extra pages cost, in total. */
  extraPagesPrice: number
  total: number
}

/** Mirrors the backend's `calculateJournalPriceBreakdown`
 * (`backend/src/shared/utils/pricing.util.ts`) — used here only for a guest's local draft, which
 * never touches the backend until submit, so its displayed price still needs to react to pages
 * being added.
 *
 * `spreadCount` (from `countSpreadSlots`) counts only interior SPREAD slots — the cover is added
 * back in here (`+ COVER_SPREAD_EQUIVALENT`) before comparing against `includedSpreads`, since
 * that threshold is expressed in "total spreads including cover" terms, not interior-only. Interior
 * spreads are always odd (`MIN_JOURNAL_SPREADS`, `applyLocalAddSpread` only ever adds pairs), so
 * `spreadCount + 1` is always even, and `includedSpreads` is validated even too — their difference
 * is therefore always a whole number of 4-page units with nothing left over; `Math.floor` is just
 * a defensive floor for any data that predates these invariants. */
export function calculateJournalPriceBreakdown(
  pricing: JournalSpreadPricing,
  spreadCount: number,
): JournalPriceBreakdown {
  const basePrice = pricing.basePrice ?? 0
  const perFourPages = pricing.pricePerExtraFourPages ?? 0
  const totalSpreadEquivalents = spreadCount + COVER_SPREAD_EQUIVALENT
  const extraSpreadEquivalents = Math.max(0, totalSpreadEquivalents - pricing.includedSpreads)
  const extraFourPageUnits = Math.floor(extraSpreadEquivalents / 2)
  const extraPages = extraFourPageUnits * 4
  const extraPagesPrice = extraFourPageUnits * perFourPages
  const includedPages = pricing.includedSpreads * 2

  return {
    basePrice,
    includedPages,
    extraPages,
    extraPagesPrice,
    total: basePrice + extraPagesPrice,
  }
}

export function calculateJournalPrice(pricing: JournalSpreadPricing, spreadCount: number): number {
  return calculateJournalPriceBreakdown(pricing, spreadCount).total
}
