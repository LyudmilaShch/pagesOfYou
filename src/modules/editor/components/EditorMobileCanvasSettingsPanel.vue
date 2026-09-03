<template>
  <div class="mobile-canvas-settings">
    <div class="mobile-canvas-settings__toggle-row">
      <span class="mobile-canvas-settings__toggle-label">Привязка к сетке</span>
      <EditorSwitch
        size="large"
        :model-value="store.snapToGridEnabled"
        :disabled="store.previewMode"
        @update:model-value="store.toggleSnapToGrid()"
      />
    </div>

    <label v-if="store.snapToGridEnabled" class="mobile-canvas-settings__field">
      <span class="mobile-canvas-settings__field-label">Шаг сетки</span>
      <v-select
        v-model="gridSizeModel"
        class="mobile-canvas-settings__vselect"
        :items="gridSizeOptions"
        variant="outlined"
        density="compact"
        hide-details
        :disabled="store.previewMode"
      />
    </label>

    <div class="mobile-canvas-settings__toggle-row">
      <span class="mobile-canvas-settings__toggle-label">Умные направляющие</span>
      <EditorSwitch
        size="large"
        :model-value="store.smartGuidesEnabled"
        :disabled="store.previewMode"
        @update:model-value="store.toggleSmartGuides()"
      />
    </div>

    <div class="mobile-canvas-settings__toggle-row">
      <span class="mobile-canvas-settings__toggle-label">Линии безопасности печати</span>
      <EditorSwitch
        size="large"
        :model-value="store.printSafeZoneEnabled"
        :disabled="store.previewMode"
        @update:model-value="store.togglePrintSafeZone()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '../store/editor.store'
import { SNAP_GRID_SIZE_OPTIONS } from '../constants/page.constants'
import EditorSwitch from './EditorSwitch.vue'

const store = useEditorStore()

const gridSizeOptions = SNAP_GRID_SIZE_OPTIONS.map((value) => ({
  title: `${value} px`,
  value,
}))

const gridSizeModel = computed({
  get: () => store.snapGridSize,
  set: (value: number) => store.setSnapGridSize(value),
})
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.mobile-canvas-settings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
}

.mobile-canvas-settings__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
}

.mobile-canvas-settings__toggle-label {
  font-size: 14px;
  color: pp.$ink;
}

.mobile-canvas-settings__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 10px;
}

.mobile-canvas-settings__field-label {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: pp.$ink-soft;
}

.mobile-canvas-settings__vselect {
  :deep(.v-field) {
    border-radius: pp.$radius;
    min-height: 44px;
  }

  :deep(.v-field__input) {
    min-height: 44px;
    font-size: 14px;
  }
}
</style>
