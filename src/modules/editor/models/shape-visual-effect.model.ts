import Konva from 'konva'

import type { EffectDescriptor, EffectExtraNodeSpec, ShapeGeometry } from './effect-descriptor.model'

export type ShapeVisualEffectType = 'glow' | 'neon' | 'blur' | 'glass' | 'gradient'

export interface GlowShapeEffectParams extends Record<string, number | string> {
  color: string
  intensity: number
  radius: number
  opacity: number
}

export interface NeonShapeEffectParams extends Record<string, number | string> {
  color: string
  intensity: number
  glowRadius: number
  opacity: number
}

export interface BlurShapeEffectParams extends Record<string, number | string> {
  blurRadius: number
}

export interface GlassShapeEffectParams extends Record<string, number | string> {
  opacity: number
  blur: number
  tintColor: string
  intensity: number
}

/** `colors` is an array (not color1/color2) so more stops can be added later without a shape change. */
export interface GradientShapeEffectParams extends Record<string, number | string> {
  mode: 'linear' | 'radial'
  color1: string
  color2: string
  opacity: number
  angle: number
}

export type ShapeVisualEffect =
  | { type: 'glow'; params: GlowShapeEffectParams }
  | { type: 'neon'; params: NeonShapeEffectParams }
  | { type: 'blur'; params: BlurShapeEffectParams }
  | { type: 'glass'; params: GlassShapeEffectParams }
  | { type: 'gradient'; params: GradientShapeEffectParams }

const COLOR_FIELD = { key: 'color', label: 'Цвет', kind: 'color' as const }

function gradientPoints(geometry: ShapeGeometry, angleDeg: number) {
  const cx = geometry.width / 2
  const cy = geometry.height / 2
  const rad = (angleDeg * Math.PI) / 180
  const radius = Math.max(geometry.width, geometry.height) / 2

  return {
    start: { x: cx - Math.cos(rad) * radius, y: cy - Math.sin(rad) * radius },
    end: { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius },
  }
}

export const SHAPE_VISUAL_EFFECT_DESCRIPTORS: Array<
  EffectDescriptor<ShapeVisualEffectType, Record<string, number | string>>
> = [
  {
    type: 'glow',
    label: 'Свечение',
    fields: [
      COLOR_FIELD,
      { key: 'intensity', label: 'Интенсивность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'radius', label: 'Радиус', kind: 'number', min: 0, max: 80, step: 1 },
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
    ],
    defaultParams: { color: '#F775BB', intensity: 70, radius: 20, opacity: 80 } satisfies GlowShapeEffectParams,
    getKonvaAttrs: (params) => ({
      shadowColor: params.color,
      shadowBlur: Number(params.radius),
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: (Number(params.intensity) / 100) * (Number(params.opacity) / 100),
      shadowEnabled: true,
    }),
  },
  {
    type: 'neon',
    label: 'Неон',
    fields: [
      COLOR_FIELD,
      { key: 'intensity', label: 'Интенсивность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'glowRadius', label: 'Радиус свечения', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
    ],
    defaultParams: {
      color: '#4AD9FF',
      intensity: 85,
      glowRadius: 24,
      opacity: 90,
    } satisfies NeonShapeEffectParams,
    // Same shadow-as-glow mechanism as 'glow', plus a colored stroke so the shape itself reads as
    // a lit neon tube rather than just a glowing silhouette.
    getKonvaAttrs: (params) => ({
      stroke: params.color,
      strokeWidth: 2,
      shadowColor: params.color,
      shadowBlur: Number(params.glowRadius),
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: (Number(params.intensity) / 100) * (Number(params.opacity) / 100),
      shadowEnabled: true,
    }),
  },
  {
    type: 'blur',
    label: 'Размытие',
    fields: [{ key: 'blurRadius', label: 'Радиус размытия', kind: 'number', min: 0, max: 40, step: 1 }],
    defaultParams: { blurRadius: 8 } satisfies BlurShapeEffectParams,
    // Blurring the shape's own rendered pixels (not just a shadow) needs a real Konva pixel
    // filter — the host component caches the node whenever `filters` is non-empty (Konva only
    // applies filters to cached nodes; see the shape cache watcher in EditorElementVisuals.vue).
    getKonvaAttrs: (params) => ({
      filters: [Konva.Filters.Blur],
      blurRadius: Number(params.blurRadius),
    }),
  },
  {
    type: 'glass',
    label: 'Стекло',
    fields: [
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'blur', label: 'Размытие', kind: 'number', min: 0, max: 30, step: 1 },
      { key: 'tintColor', label: 'Цвет оттенка', kind: 'color' },
      { key: 'intensity', label: 'Интенсивность', kind: 'number', min: 0, max: 100, step: 1 },
    ],
    defaultParams: {
      opacity: 55,
      blur: 6,
      tintColor: '#FFFFFF',
      intensity: 35,
    } satisfies GlassShapeEffectParams,
    // Frosted-glass look: the shape itself is blurred (pixel filter, needs caching) and made
    // translucent; a tinted overlay of the same silhouette on top completes the "misted" read.
    getKonvaAttrs: (params) => ({
      filters: [Konva.Filters.Blur],
      blurRadius: Number(params.blur),
      opacity: Number(params.opacity) / 100,
    }),
    getExtraNodes: (params, geometry): EffectExtraNodeSpec[] => {
      const base =
        geometry.type === 'shape-circle'
          ? {
              x: geometry.width / 2,
              y: geometry.height / 2,
              radius: Math.min(geometry.width, geometry.height) / 2,
            }
          : { width: geometry.width, height: geometry.height, cornerRadius: geometry.cornerRadius }

      return [
        {
          nodeType: geometry.type === 'shape-circle' ? 'circle' : 'rect',
          layer: 'front',
          config: {
            ...base,
            fill: params.tintColor,
            opacity: Number(params.intensity) / 100,
            listening: false,
          },
        },
      ]
    },
  },
  {
    type: 'gradient',
    label: 'Градиент',
    fields: [
      { key: 'color1', label: 'Первый цвет', kind: 'color' },
      { key: 'color2', label: 'Второй цвет', kind: 'color' },
      { key: 'opacity', label: 'Прозрачность', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'angle', label: 'Угол (линейный)', kind: 'number', min: 0, max: 360, step: 1 },
    ],
    defaultParams: {
      mode: 'linear',
      color1: '#F775BB',
      color2: '#4AD9FF',
      opacity: 100,
      angle: 45,
    } satisfies GradientShapeEffectParams,
    getKonvaAttrs: (params, geometry) => {
      const opacity = Number(params.opacity) / 100
      const stops = [0, params.color1, 1, params.color2]

      if (params.mode === 'radial') {
        const radius = Math.max(geometry.width, geometry.height) / 2
        return {
          fillPriority: 'radial-gradient',
          fillRadialGradientStartPoint: { x: geometry.width / 2, y: geometry.height / 2 },
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndPoint: { x: geometry.width / 2, y: geometry.height / 2 },
          fillRadialGradientEndRadius: radius,
          fillRadialGradientColorStops: stops,
          opacity,
        }
      }

      const { start, end } = gradientPoints(geometry, Number(params.angle))
      return {
        fillPriority: 'linear-gradient',
        fillLinearGradientStartPoint: start,
        fillLinearGradientEndPoint: end,
        fillLinearGradientColorStops: stops,
        opacity,
      }
    },
  },
]
