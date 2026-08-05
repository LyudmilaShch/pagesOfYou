import type { InjectionKey, Ref } from 'vue'

import type { PanelScreenEntry } from './use-properties-panel-stack'

export interface PropertiesPanelStackContext {
  push: (entry: PanelScreenEntry) => void
  pop: () => void
  isRoot: Ref<boolean>
}

export const PROPERTIES_PANEL_STACK_KEY: InjectionKey<PropertiesPanelStackContext> =
  Symbol('propertiesPanelStack')
