<template>
  <div class="editor-shape-color-fields">
    <EditorColorPicker
      label="Заливка"
      :model-value="element.fill"
      fallback="#E3DDD5"
      @update:model-value="emitPatch({ fill: $event })"
    />
  </div>
</template>

<script setup lang="ts">
import type { ShapeElement } from '../models/shape-element.model'
import EditorColorPicker from './EditorColorPicker.vue'

export interface ShapeColorPatch {
  fill?: string
}

defineProps<{
  element: ShapeElement
}>()

const emit = defineEmits<{
  patch: [patch: ShapeColorPatch]
}>()

function emitPatch(patch: ShapeColorPatch): void {
  emit('patch', patch)
}
</script>

<style scoped lang="scss">
.editor-shape-color-fields {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}
</style>
