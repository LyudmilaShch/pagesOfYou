<template>
  <div class="editor-photo-filter-settings-form">
    <div v-if="filter.preset" class="editor-photo-filter-settings-form__row">
      <span class="editor-photo-filter-settings-form__label">Интенсивность</span>
      <div class="editor-photo-filter-settings-form__control">
        <v-slider
          :model-value="filter.intensity"
          :min="0"
          :max="100"
          :step="1"
          color="primary"
          hide-details
          @update:model-value="patchIntensity(Number($event))"
        />
        <v-text-field
          :model-value="filter.intensity"
          type="number"
          min="0"
          max="100"
          step="1"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-photo-filter-settings-form__input"
          @update:model-value="patchIntensity(toNumber($event, filter.intensity))"
        />
      </div>
    </div>

    <div
      v-for="field in PHOTO_CORRECTION_FIELDS"
      :key="field.key"
      class="editor-photo-filter-settings-form__row"
    >
      <span class="editor-photo-filter-settings-form__label">{{ field.label }}</span>
      <div class="editor-photo-filter-settings-form__control">
        <v-slider
          :model-value="getCorrectionValue(field.key)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          color="primary"
          hide-details
          @update:model-value="patchCorrection(field.key, Number($event))"
        />
        <v-text-field
          :model-value="getCorrectionValue(field.key)"
          type="number"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-photo-filter-settings-form__input"
          @update:model-value="patchCorrection(field.key, toNumber($event, getCorrectionValue(field.key)))"
        />
      </div>
    </div>

    <div class="editor-photo-filter-settings-form__row">
      <span class="editor-photo-filter-settings-form__label">Прозрачность</span>
      <div class="editor-photo-filter-settings-form__control">
        <v-slider
          :model-value="opacityPercent"
          :min="0"
          :max="100"
          :step="1"
          color="primary"
          hide-details
          @update:model-value="emit('patch-opacity', Number($event))"
        />
        <v-text-field
          :model-value="opacityPercent"
          type="number"
          min="0"
          max="100"
          step="1"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-photo-filter-settings-form__input"
          @update:model-value="emit('patch-opacity', toNumber($event, opacityPercent))"
        />
      </div>
    </div>

    <v-btn
      block
      variant="outlined"
      color="error"
      prepend-icon="mdi-close-circle-outline"
      class="editor-photo-filter-settings-form__reset"
      @click="emit('reset')"
    >
      Сбросить фильтр
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { PHOTO_CORRECTION_FIELDS, PHOTO_CORRECTION_NEUTRAL, getPhotoFilterPresetDef, lerpCorrection } from '../../models/photo-filter.model'
import type { PhotoCorrectionParams, PhotoFilter } from '../../models/photo-filter.model'

const props = defineProps<{
  filter: PhotoFilter
  opacityPercent: number
}>()

const emit = defineEmits<{
  'patch-filter': [patch: Partial<PhotoFilter>]
  'patch-opacity': [percent: number]
  reset: []
}>()

function getCorrectionValue(key: keyof PhotoCorrectionParams): number {
  return props.filter.correction[key] ?? PHOTO_CORRECTION_NEUTRAL[key]
}

function patchCorrection(key: keyof PhotoCorrectionParams, value: number): void {
  emit('patch-filter', { correction: { ...props.filter.correction, [key]: value } })
}

function patchIntensity(value: number): void {
  if (!props.filter.preset) {
    return
  }
  const def = getPhotoFilterPresetDef(props.filter.preset)
  const clamped = Math.min(100, Math.max(0, value))
  const correction = lerpCorrection(PHOTO_CORRECTION_NEUTRAL, def.correction, clamped / 100)
  emit('patch-filter', { intensity: clamped, correction })
}

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-photo-filter-settings-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-photo-filter-settings-form__row {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.editor-photo-filter-settings-form__label {
  font-size: $font-size-body-sm;
  color: pp.$ink-soft;
}

.editor-photo-filter-settings-form__control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: $spacing-2;
  align-items: center;

  :deep(.v-slider-track__fill) {
    background-color: pp.$accent !important;
  }

  :deep(.v-slider-thumb__surface) {
    color: pp.$accent !important;
  }
}

.editor-photo-filter-settings-form__input {
  :deep(.v-field) {
    font-size: $font-size-body-sm;
  }
}
</style>
