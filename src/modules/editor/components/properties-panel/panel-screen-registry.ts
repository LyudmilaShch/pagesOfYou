import { defineAsyncComponent } from 'vue'

export const PANEL_SCREENS = {
  'text-effects': defineAsyncComponent(() => import('./screens/EditorEffectsScreen.vue')),
  'photo-filters': defineAsyncComponent(() => import('./screens/EditorPhotoFiltersScreen.vue')),
} as const

export type PanelScreenId = keyof typeof PANEL_SCREENS
