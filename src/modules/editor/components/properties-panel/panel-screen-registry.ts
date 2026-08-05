import { defineAsyncComponent } from 'vue'

export const PANEL_SCREENS = {
  'text-effects': defineAsyncComponent(() => import('./screens/EditorEffectsScreen.vue')),
} as const

export type PanelScreenId = keyof typeof PANEL_SCREENS
