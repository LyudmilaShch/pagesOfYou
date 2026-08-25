/**
 * Photo masks define only the CLIPPING AREA the photo is displayed through — never a rendered
 * copy of the image. The 7 geometric masks are purely `{ type }` data; building the actual clip
 * path for a given render box is the descriptor's job (`buildClipPath`), kept out of any UI
 * component so a new geometric mask is "add one descriptor object", nothing else.
 *
 * Custom masks ('custom') are the realized version of the "prepared for SVG masks" extension
 * point: an admin uploads an SVG in AdminCustomPhotoMasksPage, which samples the path client-side
 * (SVGGeometryElement.getPointAtLength) into a normalized (0..1) point polygon — no raw SVG/file
 * is ever stored or parsed again at render time, just plain points, embedded into the element's
 * `mask` field the same way PhotoFrameRef embeds a frame's data on selection (see
 * photo-placeholder.model.ts). Rendering a custom mask reuses the exact same point-polygon
 * technique already used for 'star'/'diamond' below — see buildPhotoMaskClipPath.
 */

export type PhotoMaskType =
  | 'circle'
  | 'oval'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'heart'
  | 'star'
  | 'diamond'
  | 'custom'

export interface PhotoMaskPoint {
  /** Normalized 0..1, objectBoundingBox-style — scaled to the actual render box at draw time. */
  x: number
  y: number
}

export type PhotoMask =
  | { type: Exclude<PhotoMaskType, 'custom'> }
  | { type: 'custom'; name: string; points: PhotoMaskPoint[] }

export interface PhotoMaskBox {
  /** Absolute — matches the render box's own coordinates (frame photo-window offsets included). */
  x: number
  y: number
  width: number
  height: number
}

/** The subset of CanvasRenderingContext2D (and Konva's context, which mirrors it) a clip path needs. */
export interface PhotoMaskClipContext {
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
  ellipse?(x: number, y: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number): void
  rect(x: number, y: number, width: number, height: number): void
  closePath(): void
}

export interface PhotoMaskDescriptor {
  type: Exclude<PhotoMaskType, 'custom'>
  label: string
  /** CSS clip-path value (objectBoundingBox-relative shapes work at any thumbnail size). */
  cssClipPath: string
  buildClipPath: (ctx: PhotoMaskClipContext, box: PhotoMaskBox) => void
}

function buildStarPoints(box: PhotoMaskBox): Array<{ x: number; y: number }> {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const outerRadius = Math.min(box.width, box.height) / 2
  const innerRadius = outerRadius * 0.382
  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI / 5) * i - Math.PI / 2
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius })
  }

  return points
}

export const PHOTO_MASK_DESCRIPTORS: PhotoMaskDescriptor[] = [
  {
    type: 'circle',
    label: 'Круг',
    cssClipPath: 'circle(50% at 50% 50%)',
    buildClipPath: (ctx, box) => {
      const radius = Math.min(box.width, box.height) / 2
      ctx.arc(box.x + box.width / 2, box.y + box.height / 2, radius, 0, Math.PI * 2)
    },
  },
  {
    type: 'oval',
    label: 'Овал',
    cssClipPath: 'ellipse(50% 50% at 50% 50%)',
    buildClipPath: (ctx, box) => {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      if (ctx.ellipse) {
        ctx.ellipse(cx, cy, box.width / 2, box.height / 2, 0, 0, Math.PI * 2)
        return
      }
      // Fallback for contexts without native ellipse() — a circle approximation is preferable to nothing.
      ctx.arc(cx, cy, Math.min(box.width, box.height) / 2, 0, Math.PI * 2)
    },
  },
  {
    type: 'rectangle',
    label: 'Прямоугольник',
    cssClipPath: 'inset(0)',
    buildClipPath: (ctx, box) => {
      ctx.rect(box.x, box.y, box.width, box.height)
    },
  },
  {
    type: 'rounded-rectangle',
    label: 'Скругленный прямоугольник',
    cssClipPath: 'inset(0 round 18%)',
    buildClipPath: (ctx, box) => {
      const radius = Math.min(box.width, box.height) * 0.18
      const { x, y, width: w, height: h } = box
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + w - radius, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
      ctx.lineTo(x + w, y + h - radius)
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
      ctx.lineTo(x + radius, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
    },
  },
  {
    type: 'diamond',
    label: 'Ромб',
    cssClipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    buildClipPath: (ctx, box) => {
      ctx.moveTo(box.x + box.width / 2, box.y)
      ctx.lineTo(box.x + box.width, box.y + box.height / 2)
      ctx.lineTo(box.x + box.width / 2, box.y + box.height)
      ctx.lineTo(box.x, box.y + box.height / 2)
      ctx.closePath()
    },
  },
  {
    type: 'star',
    label: 'Звезда',
    cssClipPath:
      'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
    buildClipPath: (ctx, box) => {
      const points = buildStarPoints(box)
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.closePath()
    },
  },
  {
    type: 'heart',
    label: 'Сердце',
    // path()/polygon() can't express a curved heart in a size-independent way; the screen renders
    // a matching <clipPath clipPathUnits="objectBoundingBox"> once and every heart card references
    // it by id, so the preview scales correctly regardless of the card's actual pixel size.
    cssClipPath: 'url(#photo-mask-heart-clip)',
    buildClipPath: (ctx, box) => {
      const { x, y, width: w, height: h } = box
      const topCurveHeight = h * 0.3
      ctx.moveTo(x + w / 2, y + topCurveHeight)
      ctx.bezierCurveTo(
        x + w / 2, y + topCurveHeight * 0.6,
        x + w * 0.1, y + topCurveHeight * 0.6,
        x + w * 0.1, y + topCurveHeight,
      )
      ctx.bezierCurveTo(x + w * 0.1, y + h * 0.65, x + w / 2, y + h * 0.8, x + w / 2, y + h)
      ctx.bezierCurveTo(x + w / 2, y + h * 0.8, x + w * 0.9, y + h * 0.65, x + w * 0.9, y + topCurveHeight)
      ctx.bezierCurveTo(
        x + w * 0.9, y + topCurveHeight * 0.6,
        x + w / 2, y + topCurveHeight * 0.6,
        x + w / 2, y + topCurveHeight,
      )
      ctx.closePath()
    },
  },
]

/** Only for the 7 built-in geometric masks — 'custom' has no fixed descriptor, see buildPhotoMaskClipPath. */
export function getPhotoMaskDescriptor(type: Exclude<PhotoMaskType, 'custom'>): PhotoMaskDescriptor {
  const def = PHOTO_MASK_DESCRIPTORS.find((entry) => entry.type === type)
  if (!def) {
    throw new Error(`Unknown photo mask type: ${type}`)
  }
  return def
}

/** CSS clip-path for a custom mask's normalized points — a plain, fully responsive polygon(). */
export function getCustomPhotoMaskCssClipPath(points: PhotoMaskPoint[]): string {
  return `polygon(${points.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(', ')})`
}

/**
 * Single entry point the adapter/UI use to get a mask's clip path, regardless of whether it's one
 * of the 7 built-ins or a 'custom' one — callers never need to branch on mask.type themselves.
 */
export function buildPhotoMaskClipPath(mask: PhotoMask, ctx: PhotoMaskClipContext, box: PhotoMaskBox): void {
  if (mask.type === 'custom') {
    const { points } = mask
    if (points.length === 0) {
      return
    }
    ctx.moveTo(box.x + points[0].x * box.width, box.y + points[0].y * box.height)
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(box.x + points[i].x * box.width, box.y + points[i].y * box.height)
    }
    ctx.closePath()
    return
  }

  getPhotoMaskDescriptor(mask.type).buildClipPath(ctx, box)
}
