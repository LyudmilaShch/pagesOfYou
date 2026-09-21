/** Interior spreads only (cover/back-cover excluded — they're accounted for separately, see
 * `pricing.util.ts`'s `COVER_PAGES`). Must be ODD: total physical pages = MIN_JOURNAL_SPREADS * 2
 * + 2 (front + back cover, 1 page each) — printing requires that total to be a multiple of 4,
 * which only holds when this interior count itself is odd (5 interior + 1 cover-equivalent
 * spread = 6 spreads = 12 pages). */
export const MIN_JOURNAL_SPREADS = 5;
