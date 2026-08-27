<template>
  <div class="editor-border-fields">
    <EditorSwitch
      :model-value="strokeEnabled"
      label="Обводка"
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
        <div class="editor-border-fields__field">
          <span class="editor-border-fields__field-label">Позиция</span>
          <v-select
            class="editor-border-fields__select"
            :model-value="strokePosition"
            :items="positionOptions"
            item-title="label"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="emitPatch({ strokePosition: $event as PhotoStrokePosition })"
          />
        </div>

        <div class="editor-border-fields__field">
          <span class="editor-border-fields__field-label">{{ strokeWidthLabel }}</span>
          <input
            type="number"
            class="editor-border-fields__px-input"
            min="1"
            :max="maxStrokeWidth"
            step="1"
            :value="strokeWidth"
            @change="emitPatch({ strokeWidth: clampStrokeWidth(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>

      <div class="editor-border-fields__field">
        <span class="editor-border-fields__field-label">Тип линии</span>
        <v-select
          class="editor-border-fields__select"
          :model-value="strokeStyle"
          :items="styleOptions"
          item-title="label"
          item-value="value"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="emitPatch({ strokeStyle: $event as PhotoStrokeStyle })"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { PHOTO_BORDER_STROKE_WIDTH_MAX } from '../constants/page.constants'
import type { PhotoStrokePosition, PhotoStrokeStyle } from '../models/photo-placeholder.model'
import EditorColorPicker from './EditorColorPicker.vue'
import EditorSwitch from './EditorSwitch.vue'

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
@use '@/modules/editor/styles/properties-panel-theme' as pp;

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

.editor-border-fields__field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  min-width: 0;
}

.editor-border-fields__field-label {
  font-size: 10px;
  font-weight: $font-weight-medium;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: pp.$ink-soft;
}

.editor-border-fields__select {
  :deep(.v-field) {
    border-radius: pp.$radius;
    min-height: 34px;
  }

  :deep(.v-field__input) {
    min-height: 34px;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 12px;
  }

  :deep(.v-field__outline) {
    color: pp.$border;
  }

  :deep(.v-field:hover .v-field__outline) {
    color: pp.$border-strong;
  }

  :deep(.v-field--focused .v-field__outline) {
    color: pp.$accent;
  }
}

.editor-border-fields__px-input {
  width: 100%;
  height: 34px;
  padding: 0 $spacing-2;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: pp.$ink;
  text-align: center;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: pp.$border-strong;
  }

  &:focus {
    border-color: pp.$accent;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}
</style>
