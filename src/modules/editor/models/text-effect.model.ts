export type TextEffectType =
  | 'drop-shadow'
  | 'glow'
  | 'echo'
  | 'outlined'
  | 'background'
  | 'stroke'
  | 'neon'

export interface DropShadowEffectParams {
  color: string
  opacity: number
  blur: number
  offsetX: number
  offsetY: number
}

export interface GlowEffectParams {
  color: string
  blur: number
  opacity: number
}

export interface EchoEffectParams {
  color: string
  copies: number
  offset: number
  opacity: number
}

export interface OutlinedEffectParams {
  color: string
  width: number
  opacity: number
}

export interface BackgroundEffectParams {
  color: string
  cornerRadius: number
  padding: number
  opacity: number
}

export interface StrokeEffectParams {
  color: string
  width: number
  opacity: number
}

export interface NeonEffectParams {
  color: string
  glow: number
  blur: number
  intensity: number
}

export type TextEffect =
  | { type: 'drop-shadow'; params: DropShadowEffectParams }
  | { type: 'glow'; params: GlowEffectParams }
  | { type: 'echo'; params: EchoEffectParams }
  | { type: 'outlined'; params: OutlinedEffectParams }
  | { type: 'background'; params: BackgroundEffectParams }
  | { type: 'stroke'; params: StrokeEffectParams }
  | { type: 'neon'; params: NeonEffectParams }

export interface TextEffectCardDef {
  type: TextEffectType
  label: string
  defaultParams: TextEffect['params']
  /** False for effects Konva can't yet render — surfaced as a "coming soon" badge in the UI. */
  rendersOnCanvas: boolean
}

export const TEXT_EFFECT_CARDS: TextEffectCardDef[] = [
  {
    type: 'drop-shadow',
    label: 'Падающая тень',
    defaultParams: { color: '#111111', opacity: 60, blur: 8, offsetX: 4, offsetY: 4 } satisfies DropShadowEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'glow',
    label: 'Подсветка',
    defaultParams: { color: '#FFD54A', blur: 16, opacity: 70 } satisfies GlowEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'echo',
    label: 'Эхо',
    defaultParams: { color: '#111111', copies: 3, offset: 6, opacity: 40 } satisfies EchoEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'outlined',
    label: 'С контуром',
    defaultParams: { color: '#111111', width: 2, opacity: 100 } satisfies OutlinedEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'background',
    label: 'Фон',
    defaultParams: { color: '#F3F1ED', cornerRadius: 8, padding: 8, opacity: 100 } satisfies BackgroundEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'stroke',
    label: 'Контур',
    defaultParams: { color: '#111111', width: 1.5, opacity: 100 } satisfies StrokeEffectParams,
    rendersOnCanvas: true,
  },
  {
    type: 'neon',
    label: 'Неон',
    defaultParams: { color: '#4AD9FF', glow: 12, blur: 10, intensity: 80 } satisfies NeonEffectParams,
    rendersOnCanvas: true,
  },
]

export function getTextEffectCardDef(type: TextEffectType): TextEffectCardDef {
  const def = TEXT_EFFECT_CARDS.find((card) => card.type === type)
  if (!def) {
    throw new Error(`Unknown text effect type: ${type}`)
  }
  return def
}

/** Accent used only for the effect demo letters — not a global design token. */
const EFFECT_DEMO_ACCENT = '#F775BB'
const EFFECT_DEMO_ACCENT_RGB = '247, 117, 187'

/** Inline style for a live-preview "Аа" glyph, shared by the effect picker strip and its full grid screen. */
export function getTextEffectDemoStyle(type: TextEffectType): Record<string, string> {
  switch (type) {
    case 'drop-shadow':
      return {
        color: '#111111',
        textShadow: `3px 3px 0 ${EFFECT_DEMO_ACCENT}`,
      }
    case 'glow':
      return {
        color: '#111111',
        textShadow: `0 0 8px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'echo':
      return {
        color: EFFECT_DEMO_ACCENT,
        textShadow: `2px 2px 0 rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.55), 4px 4px 0 rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.3)`,
      }
    case 'outlined':
      return {
        color: '#111111',
        webkitTextStroke: `1px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'background':
      return {
        color: '#ffffff',
        background: EFFECT_DEMO_ACCENT,
        padding: '0 6px',
        borderRadius: '4px',
      }
    case 'stroke':
      return {
        color: 'transparent',
        webkitTextStroke: `1.5px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'neon':
      return {
        color: EFFECT_DEMO_ACCENT,
        textShadow: `0 0 4px ${EFFECT_DEMO_ACCENT}, 0 0 10px rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.7)`,
      }
    default:
      return {}
  }
}
