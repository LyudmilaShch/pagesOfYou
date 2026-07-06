import { TRANSFORMER_ROTATE_ANCHOR_ANGLE } from '../constants/page.constants'
import { buildRotateGlyphPaths } from './rotate-glyph.util'

const CURSOR_SIZE = 31
const CURSOR_HOTSPOT = 15
const CURSOR_CENTER = 15.4
const CURSOR_RADIUS = 8.25
const ARROW_LENGTH = 3.08

/** Base glyph orientation when pointing at target above the handle. */
const CURSOR_GLYPH_ANGLE_OFFSET = 90

export function getRotateCursorAngle(nodeRotationDeg: number): number {
  return nodeRotationDeg + TRANSFORMER_ROTATE_ANCHOR_ANGLE + CURSOR_GLYPH_ANGLE_OFFSET
}

export function getRotateCursorAngleTowardTarget(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): number {
  const rad = Math.atan2(targetY - sourceY, targetX - sourceX)
  return (rad * 180) / Math.PI + CURSOR_GLYPH_ANGLE_OFFSET
}

export function buildRotateCursorSvg(rotationDeg: number): string {
  const { strokes, fills } = buildRotateGlyphPaths(
    CURSOR_CENTER,
    CURSOR_CENTER,
    CURSOR_RADIUS,
    ARROW_LENGTH,
  )
  const { fills: outlineFills } = buildRotateGlyphPaths(
    CURSOR_CENTER,
    CURSOR_CENTER,
    CURSOR_RADIUS,
    ARROW_LENGTH * 1.18,
  )
  const rotation = `rotate(${rotationDeg.toFixed(2)} ${CURSOR_CENTER} ${CURSOR_CENTER})`
  const strokeProps = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 ${CURSOR_SIZE} ${CURSOR_SIZE}">`,
    `<g transform="${rotation}">`,
    `<path d="${strokes}" ${strokeProps} stroke="#141414" stroke-width="2.9"/>`,
    `<path d="${outlineFills}" fill="#141414"/>`,
    `<path d="${strokes}" ${strokeProps} stroke="#FFFFFF" stroke-width="2.2"/>`,
    `<path d="${fills}" fill="#FFFFFF"/>`,
    `</g>`,
    `</svg>`,
  ].join('')
}

export function buildRotateCursorStyle(rotationDeg: number): string {
  const encoded = encodeURIComponent(buildRotateCursorSvg(rotationDeg))
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')

  return `url("data:image/svg+xml,${encoded}") ${CURSOR_HOTSPOT} ${CURSOR_HOTSPOT}, grab`
}
