import type { EffectDescriptor, EffectExtraNodeSpec, ShapeGeometry } from './effect-descriptor.model'

export type ShapeShadowType = 'drop' | 'inner' | 'soft' | 'long'

export interface DropShapeShadowParams extends Record<string, number | string> {
  color: string
  opacity: number
  offsetX: number
  offsetY: number
  blur: number
  spread: number
}

export interface InnerShapeShadowParams extends Record<string, number | string> {
  color: string
  opacity: number
  offsetX: number
  offsetY: number
  blur: number
  spread: number
}

export interface SoftShapeShadowParams extends Record<string, number | string> {
  color: string
  intensity: number
  blur: number
  opacity: number
}

export interface LongShapeShadowParams extends Record<string, number | string> {
  color: string
  opacity: number
  length: number
  angle: number
}

export type ShapeShadowParamsFor<T extends ShapeShadowType> = T extends 'drop'
  ? DropShapeShadowParams
  : T extends 'inner'
    ? InnerShapeShadowParams
    : T extends 'soft'
      ? SoftShapeShadowParams
      : LongShapeShadowParams

export type ShapeShadow =
  | { type: 'drop'; params: DropShapeShadowParams }
  | { type: 'inner'; params: InnerShapeShadowParams }
  | { type: 'soft'; params: SoftShapeShadowParams }
  | { type: 'long'; params: LongShapeShadowParams }

export const SHAPE_SHADOW_ICONS: Record<ShapeShadowType, string> = {
  drop: 'mdi-box-shadow',
  inner: 'mdi-square-opacity',
  soft: 'mdi-blur',
  long: 'mdi-arrow-bottom-right-thin',
}

const COLOR_FIELD = { key: 'color', label: 'Цвет', kind: 'color' as const }

function shapeExtraNodeBase(geometry: ShapeGeometry): Record<string, unknown> {
  if (geometry.type === 'shape-circle') {
    return {
      x: geometry.width / 2,
      y: geometry.height / 2,
      radius: Math.min(geometry.width, geometry.height) / 2,
    }
  }

  return {
    width: geometry.width,
    height: geometry.height,
    cornerRadius: geometry.cornerRadius,
  }
}

function shapeClipFunc(geometry: ShapeGeometry) {
  return (ctx: { rect: (x: number, y: number, w: number, h: number) => void; beginPath: () => void; arc: (x: number, y: number, r: number, s: number, e: number) => void }) => {
    if (geometry.type === 'shape-circle') {
      const radius = Math.min(geometry.width, geometry.height) / 2
      ctx.beginPath()
      ctx.arc(geometry.width / 2, geometry.height / 2, radius, 0, Math.PI * 2)
      return
    }

    ctx.rect(0, 0, geometry.width, geometry.height)
  }
}

export const SHAPE_SHADOW_DESCRIPTORS: Array<EffectDescriptor<ShapeShadowType, Record<string, number | string>>> = [
  {
    type: 'drop',
    label: 'Падающая тень',
    fields: [
      COLOR_FIELD,
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'offsetX', label: 'Смещение X', kind: 'number', min: -60, max: 60, step: 1 },
      { key: 'offsetY', label: 'Смещение Y', kind: 'number', min: -60, max: 60, step: 1 },
      { key: 'blur', label: 'Размытие', kind: 'number', min: 0, max: 60, step: 1 },
      { key: 'spread', label: 'Распространение', kind: 'number', min: 0, max: 40, step: 1 },
    ],
    defaultParams: {
      color: '#111111',
      opacity: 55,
      offsetX: 6,
      offsetY: 6,
      blur: 10,
      spread: 0,
    } satisfies DropShapeShadowParams,
    getKonvaAttrs: (params) => ({
      shadowColor: params.color,
      shadowOpacity: Number(params.opacity) / 100,
      shadowOffsetX: Number(params.offsetX),
      shadowOffsetY: Number(params.offsetY),
      shadowBlur: Number(params.blur) + Number(params.spread),
      shadowEnabled: true,
    }),
  },
  {
    type: 'inner',
    label: 'Внутренняя тень',
    fields: [
      COLOR_FIELD,
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'offsetX', label: 'Смещение X', kind: 'number', min: -40, max: 40, step: 1 },
      { key: 'offsetY', label: 'Смещение Y', kind: 'number', min: -40, max: 40, step: 1 },
      { key: 'blur', label: 'Размытие', kind: 'number', min: 0, max: 40, step: 1 },
      { key: 'spread', label: 'Распространение', kind: 'number', min: 0, max: 40, step: 1 },
    ],
    defaultParams: {
      color: '#111111',
      opacity: 60,
      offsetX: 4,
      offsetY: 4,
      blur: 12,
      spread: 6,
    } satisfies InnerShapeShadowParams,
    // Konva has no native inset shadow — approximated with a same-shaped, offset, blurred fill
    // clipped to the shape's own silhouette (a Group with clipFunc), so only the sliver that
    // bleeds past the shrink-by-spread inset reads as a soft inner shadow near the edge.
    getExtraNodes: (params, geometry): EffectExtraNodeSpec[] => {
      const spread = Number(params.spread)
      const inset = shapeExtraNodeBase(geometry)
      const shrunk: Record<string, unknown> =
        geometry.type === 'shape-circle'
          ? { ...inset, radius: Math.max(0, (inset.radius as number) - spread) }
          : {
              ...inset,
              x: spread,
              y: spread,
              width: Math.max(0, (inset.width as number) - spread * 2),
              height: Math.max(0, (inset.height as number) - spread * 2),
            }

      return [
        {
          nodeType: 'group',
          layer: 'front',
          config: {
            clipFunc: shapeClipFunc(geometry),
            listening: false,
          },
          children: [
            {
              // Solid fill + the shape's own native shadow (same color, zero offset) — both
              // native Konva Shape properties, so this needs no .cache()/pixel-filter pass. Offset
              // and shrunk-by-spread, then clipped to the parent's silhouette by the group above:
              // only the sliver near the edge stays visible, reading as a soft inset shadow.
              nodeType: geometry.type === 'shape-circle' ? 'circle' : 'rect',
              layer: 'front',
              config: {
                ...shrunk,
                x: (shrunk.x as number | undefined ?? 0) + Number(params.offsetX),
                y: (shrunk.y as number | undefined ?? 0) + Number(params.offsetY),
                fill: params.color,
                opacity: Number(params.opacity) / 100,
                shadowColor: params.color,
                shadowBlur: Number(params.blur),
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowOpacity: 1,
                shadowEnabled: true,
                listening: false,
              },
            },
          ],
        },
      ]
    },
  },
  {
    type: 'soft',
    label: 'Мягкая тень',
    fields: [
      COLOR_FIELD,
      { key: 'intensity', label: 'Интенсивность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'blur', label: 'Размытие', kind: 'number', min: 0, max: 80, step: 1 },
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
    ],
    defaultParams: {
      color: '#111111',
      intensity: 60,
      blur: 30,
      opacity: 40,
    } satisfies SoftShapeShadowParams,
    // A uniform, zero-offset glow-style shadow — reuses the same Konva shadow mechanism as the
    // drop shadow, radiating evenly instead of pointing in one direction.
    getKonvaAttrs: (params) => ({
      shadowColor: params.color,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: Number(params.blur),
      shadowOpacity: (Number(params.intensity) / 100) * (Number(params.opacity) / 100),
      shadowEnabled: true,
    }),
  },
  {
    type: 'long',
    label: 'Длинная тень',
    fields: [
      COLOR_FIELD,
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'length', label: 'Длина', kind: 'number', min: 0, max: 200, step: 1 },
      { key: 'angle', label: 'Угол', kind: 'number', min: 0, max: 360, step: 1 },
    ],
    defaultParams: {
      color: '#111111',
      opacity: 35,
      length: 60,
      angle: 45,
    } satisfies LongShapeShadowParams,
    // Konva has no "trail" primitive — approximated (same technique as the text Echo effect)
    // with a dense stack of offset copies of the shape's own silhouette along the given angle,
    // read together as one continuous long-shadow trail.
    getExtraNodes: (params, geometry): EffectExtraNodeSpec[] => {
      const length = Number(params.length)
      const angleRad = (Number(params.angle) * Math.PI) / 180
      const stepPx = 2
      const steps = Math.min(80, Math.max(1, Math.round(length / stepPx)))
      const base = shapeExtraNodeBase(geometry)

      return Array.from({ length: steps }, (_, index) => {
        const distance = ((index + 1) / steps) * length
        const dx = Math.cos(angleRad) * distance
        const dy = Math.sin(angleRad) * distance

        return {
          nodeType: geometry.type === 'shape-circle' ? 'circle' : 'rect',
          layer: 'behind' as const,
          config: {
            ...base,
            x: (base.x as number | undefined ?? 0) + dx,
            y: (base.y as number | undefined ?? 0) + dy,
            fill: params.color,
            opacity: Number(params.opacity) / 100,
            listening: false,
          },
        }
      })
    },
  },
]
