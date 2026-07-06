<template>
  <div class="editor-border-fields">
    <v-switch
      :model-value="strokeEnabled"
      label="Обводка"
      color="primary"
      hide-details
      @update:model-value="toggleStroke"
    />

    <template v-if="strokeEnabled">
      <EditorColorPicker
        :model-value="stroke"
        :label="strokeLabel"
        :fallback="strokeFallback"
        @update:model-value="emitPatch({ stroke: $event })"
      />

      <div class="editor-border-fields__row">
        <v-select
          :model-value="strokePosition"
          :items="positionOptions"
          item-title="label"
          item-value="value"
          label="Позиция"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="emitPatch({ strokePosition: $event as PhotoStrokePosition })"
        />

        <v-text-field
          :model-value="strokeWidth"
          :label="strokeWidthLabel"
          type="number"
          :min="1"
          :max="maxStrokeWidth"
          step="1"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="emitPatch({ strokeWidth: clampStrokeWidth($event) })"
        />
      </div>

      <v-select
        :model-value="strokeStyle"
        :items="styleOptions"
        item-title="label"
        item-value="value"
        label="Тип линии"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="emitPatch({ strokeStyle: $event as PhotoStrokeStyle })"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { PHOTO_BORDER_STROKE_WIDTH_MAX } from '../constants/page.constants'
import type { PhotoStrokePosition, PhotoStrokeStyle } from '../models/photo-placeholder.model'
import EditorColorPicker from './EditorColorPicker.vue'

const props = withDefaults(
  defineProps<{
    stroke: string
    strokeWidth: number
    strokeStyle: PhotoStrokeStyle
    strokePosition: PhotoStrokePosition
    strokeLabel?: string
    strokeWidthLabel?: string
    strokeFallback?: string
    maxStrokeWidth?: number
  }>(),
  {
    strokeLabel: 'Цвет обводки',
    strokeWidthLabel: 'Толщина',
    strokeFallback: '#111111',
    maxStrokeWidth: PHOTO_BORDER_STROKE_WIDTH_MAX,
  },
)

const emit = defineEmits<{
  patch: [patch: {
    stroke?: string
    strokeWidth?: number
    strokeStyle?: PhotoStrokeStyle
    strokePosition?: PhotoStrokePosition
  }]
}>()

const strokeEnabled = computed(() => props.strokeWidth > 0)

const positionOptions = [
  { label: 'По центру', value: 'center' },
  { label: 'Внутри', value: 'inside' },
  { label: 'Снаружи', value: 'outside' },
]

const styleOptions = [
  { label: 'Сплошная', value: 'solid' },
  { label: 'Пунктирная', value: 'dashed' },
]

function clampStrokeWidth(value: string | number | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return props.strokeWidth > 0 ? props.strokeWidth : 1
  }

  return Math.min(props.maxStrokeWidth, Math.max(1, Math.round(parsed)))
}

function emitPatch(patch: {
  stroke?: string
  strokeWidth?: number
  strokeStyle?: PhotoStrokeStyle
  strokePosition?: PhotoStrokePosition
}): void {
  emit('patch', patch)
}

function toggleStroke(enabled: boolean | null): void {
  if (!enabled) {
    emitPatch({ strokeWidth: 0 })
    return
  }

  emitPatch({
    stroke: props.stroke || props.strokeFallback,
    strokeWidth: props.strokeWidth > 0 ? props.strokeWidth : 1,
    strokeStyle: props.strokeStyle || 'solid',
    strokePosition: props.strokePosition || 'center',
  })
}
</script>

<style scoped lang="scss">
.editor-border-fields {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-border-fields__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: $spacing-2;
}
</style>
