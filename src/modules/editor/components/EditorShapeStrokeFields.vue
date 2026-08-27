<template>
  <div class="editor-shape-stroke-fields">
    <EditorColorPicker
      v-if="showFill"
      label="Заливка"
      :model-value="element.fill"
      fallback="#E3DDD5"
      @update:model-value="emitPatch({ fill: $event })"
    />

    <div v-if="showCornerRadius" class="editor-shape-stroke-fields__field">
      <span class="editor-shape-stroke-fields__field-label">Скругление углов</span>
      <input
        type="number"
        class="editor-shape-stroke-fields__px-input"
        min="0"
        :value="element.cornerRadius"
        @change="emitPatch({ cornerRadius: toNumber(($event.target as HTMLInputElement).value, element.cornerRadius) })"
      />
    </div>

    <EditorSwitch
      v-if="optionalStroke"
      :model-value="strokeEnabled"
      label="Обводка"
      @update:model-value="toggleStroke"
    />

    <template v-if="!optionalStroke || strokeEnabled">
      <EditorColorPicker
        :label="strokeLabel"
        :model-value="element.stroke"
        fallback="#111111"
        @update:model-value="emitPatch({ stroke: $event })"
      />

      <div class="editor-shape-stroke-fields__field">
        <span class="editor-shape-stroke-fields__field-label">{{ strokeWidthLabel }}</span>
        <input
          type="number"
          class="editor-shape-stroke-fields__px-input"
          min="1"
          :max="SHAPE_STROKE_WIDTH_MAX"
          step="1"
          :value="element.strokeWidth"
          @change="emitPatch({ strokeWidth: clampStrokeWidth(($event.target as HTMLInputElement).value) })"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { SHAPE_STROKE_WIDTH_MAX } from '../constants/page.constants'
import type { ShapeElement } from '../models/shape-element.model'
import EditorColorPicker from './EditorColorPicker.vue'
import EditorSwitch from './EditorSwitch.vue'

export interface ShapeStrokePatch {
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
}

const props = withDefaults(
  defineProps<{
    element: ShapeElement
    showFill?: boolean
    showCornerRadius?: boolean
    optionalStroke?: boolean
    strokeLabel?: string
    strokeWidthLabel?: string
  }>(),
  {
    showFill: true,
    showCornerRadius: false,
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

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
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
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-shape-stroke-fields {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-shape-stroke-fields__field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.editor-shape-stroke-fields__field-label {
  font-size: 10px;
  font-weight: $font-weight-medium;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: pp.$ink-soft;
}

.editor-shape-stroke-fields__px-input {
  width: 100%;
  height: 34px;
  padding: 0 $spacing-2;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: pp.$ink;
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
