import { defineAsyncComponent } from 'vue'

export const PANEL_SCREENS = {
  'text-effects': defineAsyncComponent(() => import('./screens/EditorEffectsScreen.vue')),
  'photo-filters': defineAsyncComponent(() => import('./screens/EditorPhotoFiltersScreen.vue')),
  'shape-shadow': defineAsyncComponent(() => import('./screens/EditorShapeShadowScreen.vue')),
  'shape-visual-effect': defineAsyncComponent(() => import('./screens/EditorShapeEffectScreen.vue')),
  'photo-mask': defineAsyncComponent(() => import('./screens/EditorPhotoMaskScreen.vue')),
} as const

export type PanelScreenId = keyof typeof PANEL_SCREENS
