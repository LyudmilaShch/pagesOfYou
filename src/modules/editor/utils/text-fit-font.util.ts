/**
 * Shrink-to-fit for a customer's text box. The frame stays where the template put it; only the
 * font size changes, and never above the size the template was designed at.
 * Same idea as list rows (list-distribution.util.ts scales a font down to a floor, then stops):
 * the floor here is half the design size. Lists themselves are not fitted by this function.
 */
export const TEXT_FIT_MIN_FONT_SCALE = 0.5

export function fitFontSizeToBox(input: {
  designFontSize: number
  /** Returns whether `fontSize` still fits inside the stationary frame. Must be monotonic. */
  fits: (fontSize: number) => boolean
  minScale?: number
}): number {
  const design = Math.max(1, Math.round(input.designFontSize))
  const min = Math.max(
    1,
    Math.round(design * (input.minScale ?? TEXT_FIT_MIN_FONT_SCALE)),
  )

  if (input.fits(design)) {
    return design
  }

  if (min >= design || !input.fits(min)) {
    return min
  }

  let low = min
  let high = design

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (input.fits(mid)) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return low
}
