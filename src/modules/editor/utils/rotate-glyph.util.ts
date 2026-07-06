/**
 * Cursor-only rotate glyph — ~1/3 circle arc with outward arrowheads at both ends.
 */

/** ~120° arc through the bottom (smile shape). */
export const ROTATE_GLYPH_ARC_START = (5 * Math.PI) / 6
export const ROTATE_GLYPH_ARC_END = Math.PI / 6

function polar(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  anticlockwise: boolean,
): string {
  const start = polar(cx, cy, radius, startAngle)
  const end = polar(cx, cy, radius, endAngle)

  let delta = endAngle - startAngle
  if (anticlockwise) {
    if (delta > 0) {
      delta -= Math.PI * 2
    }
  } else if (delta < 0) {
    delta += Math.PI * 2
  }

  const largeArc = Math.abs(delta) > Math.PI ? 1 : 0
  const sweep = anticlockwise ? 0 : 1

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(' ')
}

function describeFilledArrow(
  tipX: number,
  tipY: number,
  direction: number,
  length: number,
  width: number,
): string {
  const baseX = tipX - length * Math.cos(direction)
  const baseY = tipY - length * Math.sin(direction)
  const leftX = baseX + width * Math.cos(direction + Math.PI / 2)
  const leftY = baseY + width * Math.sin(direction + Math.PI / 2)
  const rightX = baseX + width * Math.cos(direction - Math.PI / 2)
  const rightY = baseY + width * Math.sin(direction - Math.PI / 2)

  return [
    `M ${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
    `L ${leftX.toFixed(2)} ${leftY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${rightY.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function buildRotateGlyphPaths(
  cx: number,
  cy: number,
  radius: number,
  arrowLength: number,
): { strokes: string; fills: string } {
  const startTip = polar(cx, cy, radius, ROTATE_GLYPH_ARC_START)
  const endTip = polar(cx, cy, radius, ROTATE_GLYPH_ARC_END)
  const arrowWidth = arrowLength * 1.15

  // Left: up-left ↖ along arc; right: up-right ↗ along continuation.
  const startArrowDir = ROTATE_GLYPH_ARC_START + Math.PI / 2
  const endArrowDir = ROTATE_GLYPH_ARC_END - Math.PI / 2

  const strokes = describeArc(
    cx,
    cy,
    radius,
    ROTATE_GLYPH_ARC_START,
    ROTATE_GLYPH_ARC_END,
    true,
  )

  const fills = [
    describeFilledArrow(startTip.x, startTip.y, startArrowDir, arrowLength, arrowWidth),
    describeFilledArrow(endTip.x, endTip.y, endArrowDir, arrowLength, arrowWidth),
  ].join(' ')

  return { strokes, fills }
}
