<template>
  <div class="editor-effect-settings-form">
    <EditorColorPicker
      label="Цвет"
      :model-value="effect.params.color"
      fallback="#111111"
      @update:model-value="emitPatch({ color: $event })"
    />

    <div v-if="hasOpacity" class="editor-effect-settings-form__row">
      <span class="editor-effect-settings-form__label">Прозрачность</span>
      <div class="editor-effect-settings-form__control">
        <v-slider
          :model-value="getFieldValue('opacity')"
          :min="0"
          :max="100"
          :step="1"
          color="primary"
          hide-details
          @update:model-value="emitPatch({ opacity: Number($event) })"
        />
        <v-text-field
          :model-value="getFieldValue('opacity')"
          type="number"
          :min="0"
          :max="100"
          step="1"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-effect-settings-form__input"
          @update:model-value="emitPatch({ opacity: toNumber($event, getFieldValue('opacity')) })"
        />
      </div>
    </div>

    <div v-for="field in numberFields" :key="field.key" class="editor-effect-settings-form__row">
      <span class="editor-effect-settings-form__label">{{ field.label }}</span>
      <div class="editor-effect-settings-form__control">
        <v-slider
          :model-value="getFieldValue(field.key)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          color="primary"
          hide-details
          @update:model-value="emitPatch({ [field.key]: Number($event) })"
        />
        <v-text-field
          :model-value="getFieldValue(field.key)"
          type="number"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-effect-settings-form__input"
          @update:model-value="emitPatch({ [field.key]: toNumber($event, getFieldValue(field.key)) })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { TextEffect } from '../../models/text-effect.model'
import { TEXT_EFFECT_FIELDS } from './text-effect-fields.config'
import EditorColorPicker from '../EditorColorPicker.vue'

const props = defineProps<{ effect: TextEffect }>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
}>()

const numberFields = computed(() => TEXT_EFFECT_FIELDS[props.effect.type])
const hasOpacity = computed(() => 'opacity' in props.effect.params)

function getFieldValue(key: string): number {
  const value = (props.effect.params as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : 0
}

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function emitPatch(patch: Record<string, unknown>): void {
  emit('patch', patch)
}
</script>

<style scoped lang="scss">
.editor-effect-settings-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-effect-settings-form__row {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.editor-effect-settings-form__label {
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

.editor-effect-settings-form__control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: $spacing-2;
  align-items: center;
}

.editor-effect-settings-form__input {
  :deep(.v-field) {
    font-size: $font-size-body-sm;
  }
}
</style>
