const DEFAULT_PAGE_BACKGROUNDS = new Set(['#FFFFFF', '#ffffff', '#F3F1ED', '#f3f1ed'])

interface LegacyBackgroundLike {
  type: string
  color?: string
  zIndex?: number
}

/** Move legacy `background` elements into page-level backgroundColor and drop them. */
export function migrateLegacyBackgroundElements<T extends LegacyBackgroundLike>(
  elements: T[],
  pageBackgroundColor?: string,
): { elements: T[]; backgroundColor: string | undefined } {
  const legacyBackgrounds = elements.filter((element) => element.type === 'background')
  const otherElements = elements.filter((element) => element.type !== 'background')

  if (legacyBackgrounds.length === 0) {
    return { elements: otherElements, backgroundColor: pageBackgroundColor }
  }

  const bottomBackground = [...legacyBackgrounds].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0),
  )[0]
  const legacyColor =
    typeof bottomBackground?.color === 'string' ? bottomBackground.color : undefined

  const shouldApplyLegacyColor =
    legacyColor != null &&
    (pageBackgroundColor == null || DEFAULT_PAGE_BACKGROUNDS.has(pageBackgroundColor))

  return {
    elements: otherElements,
    backgroundColor: shouldApplyLegacyColor ? legacyColor : pageBackgroundColor,
  }
}
