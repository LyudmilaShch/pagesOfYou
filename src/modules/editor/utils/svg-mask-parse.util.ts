/**
 * Turns an uploaded SVG file into a normalized (0..1) point polygon a photo mask can clip to.
 * The raw SVG is never stored — only the sampled points, via the same technique the mask-based
 * clip rendering already uses for 'star'/'diamond' (see photo-mask.model.ts).
 */

const SAMPLE_POINT_COUNT = 128
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export interface ParsedSvgMask {
  points: Array<{ x: number; y: number }>
}

export class SvgMaskParseError extends Error {}

function findFirstPathData(doc: Document): string {
  const path = doc.querySelector('path')
  const d = path?.getAttribute('d')?.trim()

  if (!d) {
    throw new SvgMaskParseError('В SVG-файле не найден элемент <path> с атрибутом d.')
  }

  return d
}

export async function parseSvgMaskFile(file: File): Promise<ParsedSvgMask> {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')

  if (doc.querySelector('parsererror')) {
    throw new SvgMaskParseError('Не удалось прочитать файл как SVG.')
  }

  const pathData = findFirstPathData(doc)

  // getTotalLength()/getPointAtLength()/getBBox() only work reliably once the element is attached
  // to a live document — kept fully offscreen and removed immediately after sampling.
  const host = document.createElementNS(SVG_NAMESPACE, 'svg')
  host.setAttribute('width', '0')
  host.setAttribute('height', '0')
  host.style.position = 'fixed'
  host.style.left = '-9999px'
  host.style.top = '-9999px'

  const pathEl = document.createElementNS(SVG_NAMESPACE, 'path')
  pathEl.setAttribute('d', pathData)
  host.appendChild(pathEl)
  document.body.appendChild(host)

  try {
    const totalLength = pathEl.getTotalLength()
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      throw new SvgMaskParseError('Контур маски пустой или некорректный.')
    }

    const bbox = pathEl.getBBox()
    if (bbox.width <= 0 || bbox.height <= 0) {
      throw new SvgMaskParseError('Не удалось определить границы фигуры в SVG.')
    }

    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i < SAMPLE_POINT_COUNT; i += 1) {
      const point = pathEl.getPointAtLength((i / SAMPLE_POINT_COUNT) * totalLength)
      points.push({
        x: (point.x - bbox.x) / bbox.width,
        y: (point.y - bbox.y) / bbox.height,
      })
    }

    return { points }
  } finally {
    document.body.removeChild(host)
  }
}
