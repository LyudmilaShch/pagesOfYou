<template>
  <div class="editor-shape-stroke-fields">
    <EditorColorPicker
      v-if="showFill"
      label="Заливка"
      :model-value="element.fill"
      fallback="#E3DDD5"
      @update:model-value="emitPatch({ fill: $event })"
    />

    <template v-if="optionalStroke">
      <v-switch
        :model-value="strokeEnabled"
        label="Обводка"
        color="primary"
        hide-details
        @update:model-value="toggleStroke"
      />

      <template v-if="strokeEnabled">
        <EditorColorPicker
          :label="strokeLabel"
          :model-value="element.stroke"
          fallback="#111111"
          @update:model-value="emitPatch({ stroke: $event })"
        />

        <v-text-field
          :model-value="element.strokeWidth"
          :label="strokeWidthLabel"
          type="number"
          :min="1"
          :max="SHAPE_STROKE_WIDTH_MAX"
          step="1"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="emitPatch({ strokeWidth: clampStrokeWidth($event) })"
        />
      </template>
    </template>

    <template v-else>
      <EditorColorPicker
        :label="strokeLabel"
        :model-value="element.stroke"
        fallback="#111111"
        @update:model-value="emitPatch({ stroke: $event })"
      />

      <v-text-field
        :model-value="element.strokeWidth"
        :label="strokeWidthLabel"
        type="number"
        :min="1"
        :max="SHAPE_STROKE_WIDTH_MAX"
        step="1"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="emitPatch({ strokeWidth: clampStrokeWidth($event) })"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { SHAPE_STROKE_WIDTH_MAX } from '../constants/page.constants'
import type { ShapeElement } from '../models/shape-element.model'
import EditorColorPicker from './EditorColorPicker.vue'

export interface ShapeStrokePatch {
  fill?: string
  stroke?: string
  strokeWidth?: number
}

const props = withDefaults(
  defineProps<{
    element: ShapeElement
    showFill?: boolean
    optionalStroke?: boolean
    strokeLabel?: string
    strokeWidthLabel?: string
  }>(),
  {
    showFill: true,
    optionalStroke: false,
    strokeLabel: 'Цвет обводки',
    strokeWidthLabel: 'Толщина',
  },
)

const emit = defineEmits<{
  patch: [patch: ShapeStrokePatch]
}>()

const strokeEnabled = computed(() => props.element.strokeWidth > 0)

function clampStrokeWidth(value: string | number | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return props.element.strokeWidth > 0 ? props.element.strokeWidth : 1
  }

  return Math.min(SHAPE_STROKE_WIDTH_MAX, Math.max(1, Math.round(parsed)))
}

function emitPatch(patch: ShapeStrokePatch): void {
  emit('patch', patch)
}

function toggleStroke(enabled: boolean | null): void {
  if (!enabled) {
    emitPatch({ strokeWidth: 0 })
    return
  }

  emitPatch({
    stroke: props.element.stroke || '#111111',
    strokeWidth: props.element.strokeWidth > 0 ? props.element.strokeWidth : 1,
  })
}
</script>

<style scoped lang="scss">
.editor-shape-stroke-fields {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}
</style>
