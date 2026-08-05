import type { TextEffectType } from '../../models/text-effect.model'

export interface EffectNumberField {
  key: string
  label: string
  min: number
  max: number
  step: number
}

/**
 * Color + opacity are common to every effect and rendered once by EditorEffectSettingsForm.
 * This table only covers the remaining, effect-specific numeric fields.
 */
export const TEXT_EFFECT_FIELDS: Record<TextEffectType, EffectNumberField[]> = {
  'drop-shadow': [
    { key: 'blur', label: 'Размытие', min: 0, max: 40, step: 1 },
    { key: 'offsetX', label: 'Смещение X', min: -40, max: 40, step: 1 },
    { key: 'offsetY', label: 'Смещение Y', min: -40, max: 40, step: 1 },
  ],
  glow: [{ key: 'blur', label: 'Размытие', min: 0, max: 60, step: 1 }],
  echo: [
    { key: 'copies', label: 'Количество копий', min: 1, max: 8, step: 1 },
    { key: 'offset', label: 'Смещение', min: 1, max: 30, step: 1 },
  ],
  outlined: [{ key: 'width', label: 'Толщина', min: 0.5, max: 12, step: 0.5 }],
  background: [
    { key: 'cornerRadius', label: 'Скругление', min: 0, max: 40, step: 1 },
    { key: 'padding', label: 'Отступы', min: 0, max: 40, step: 1 },
  ],
  stroke: [{ key: 'width', label: 'Толщина', min: 0.5, max: 12, step: 0.5 }],
  neon: [
    { key: 'glow', label: 'Свечение', min: 0, max: 40, step: 1 },
    { key: 'blur', label: 'Размытие', min: 0, max: 40, step: 1 },
    { key: 'intensity', label: 'Интенсивность', min: 0, max: 100, step: 1 },
  ],
}
