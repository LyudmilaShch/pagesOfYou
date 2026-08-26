<template>
  <div class="editor-photo-filters-screen">
    <div class="editor-photo-filters-screen__presets">
      <button
        type="button"
        class="editor-photo-filters-screen__card"
        :class="{ 'editor-photo-filters-screen__card--active': !activeFilter }"
        @click="selectNone"
      >
        <span class="editor-photo-filters-screen__thumb">
          <img v-if="photoUrl" :src="photoUrl" alt="" />
          <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
          <v-icon v-if="!activeFilter" size="14" class="editor-photo-filters-screen__check">mdi-check</v-icon>
        </span>
        <span class="editor-photo-filters-screen__label">Без фильтра</span>
      </button>

      <button
        v-for="preset in PHOTO_FILTER_PRESETS"
        :key="preset.key"
        type="button"
        class="editor-photo-filters-screen__card"
        :class="{ 'editor-photo-filters-screen__card--active': isPresetActive(preset.key) }"
        @click="selectPreset(preset.key)"
      >
        <span class="editor-photo-filters-screen__thumb">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt=""
            :style="{ filter: getCssFilterPreview(preset.correction) }"
          />
          <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
          <v-icon
            v-if="isPresetActive(preset.key)"
            size="14"
            class="editor-photo-filters-screen__check"
          >
            mdi-check
          </v-icon>
        </span>
        <span class="editor-photo-filters-screen__label">{{ preset.label }}</span>
      </button>
    </div>

    <div v-if="activeFilter?.preset" class="editor-photo-filters-screen__row">
      <span class="editor-photo-filters-screen__row-label">Интенсивность</span>
      <div class="editor-photo-filters-screen__row-control">
        <v-slider
          :model-value="activeFilter.intensity"
          :min="0"
          :max="100"
          :step="1"
          color="primary"
          hide-details
          @update:model-value="patchIntensity(Number($event))"
        />
        <v-text-field
          :model-value="activeFilter.intensity"
          type="number"
          min="0"
          max="100"
          step="1"
          density="compact"
          variant="outlined"
          hide-details
          class="editor-photo-filters-screen__row-input"
          @update:model-value="patchIntensity(toNumber($event, activeFilter.intensity))"
        />
      </div>
    </div>

    <div class="editor-photo-filters-screen__correction">
      <p class="editor-photo-filters-screen__section-title">Пользовательские настройки</p>

      <div
        v-for="field in CORRECTION_FIELDS"
        :key="field.key"
        class="editor-photo-filters-screen__row"
      >
        <span class="editor-photo-filters-screen__row-label">{{ field.label }}</span>
        <div class="editor-photo-filters-screen__row-control">
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
            class="editor-photo-filters-screen__row-input"
            @update:model-value="patchCorrection(field.key, toNumber($event, getCorrectionValue(field.key)))"
          />
        </div>
      </div>

      <div class="editor-photo-filters-screen__row">
        <span class="editor-photo-filters-screen__row-label">Прозрачность</span>
        <div class="editor-photo-filters-screen__row-control">
          <v-slider
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            :step="1"
            color="primary"
            hide-details
            @update:model-value="patchOpacity(Number($event))"
          />
          <v-text-field
            :model-value="opacityPercent"
            type="number"
            :min="0"
            :max="100"
            step="1"
            density="compact"
            variant="outlined"
            hide-details
            class="editor-photo-filters-screen__row-input"
            @update:model-value="patchOpacity(toNumber($event, opacityPercent))"
          />
        </div>
      </div>
    </div>

    <v-btn
      block
      variant="outlined"
      color="error"
      prepend-icon="mdi-close-circle-outline"
      class="editor-photo-filters-screen__reset"
      @click="resetFilter"
    >
      Сбросить фильтр
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import {
  PHOTO_FILTER_PRESETS,
  PHOTO_CORRECTION_NEUTRAL,
  getPhotoFilterPresetDef,
  getCssFilterPreview,
  isCustomPhotoFilter,
  lerpCorrection,
} from '../../../models/photo-filter.model'
import type { PhotoCorrectionParams, PhotoFilter, PhotoFilterPresetKey } from '../../../models/photo-filter.model'
import type { PhotoPlaceholder } from '../../../models/photo-placeholder.model'
import { resolveAssetUrl } from '@/shared/config/assets'

interface CorrectionField {
  key: keyof PhotoCorrectionParams
  label: string
  min: number
  max: number
  step: number
}

const CORRECTION_FIELDS: CorrectionField[] = [
  { key: 'brightness', label: 'Яркость', min: -100, max: 100, step: 1 },
  { key: 'contrast', label: 'Контраст', min: -100, max: 100, step: 1 },
  { key: 'saturation', label: 'Насыщенность', min: -100, max: 100, step: 1 },
  { key: 'temperature', label: 'Температура', min: -100, max: 100, step: 1 },
  { key: 'hue', label: 'Оттенок', min: -180, max: 180, step: 1 },
  { key: 'blur', label: 'Размытие', min: 0, max: 20, step: 1 },
]

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const photoElement = computed(() => selected.value as PhotoPlaceholder | null)
const activeFilter = computed<PhotoFilter | null>(() => photoElement.value?.filter ?? null)
const photoUrl = computed(() => resolveAssetUrl(photoElement.value?.defaultImageUrl ?? null) ?? undefined)

const opacityPercent = computed(() => Math.round((photoElement.value?.opacity ?? 1) * 100))

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function isPresetActive(key: PhotoFilterPresetKey): boolean {
  const filter = activeFilter.value
  return Boolean(filter && filter.preset === key && !isCustomPhotoFilter(filter))
}

function selectNone(): void {
  patchElement({ filter: null })
}

function selectPreset(key: PhotoFilterPresetKey): void {
  const def = getPhotoFilterPresetDef(key)
  patchElement({ filter: { preset: key, intensity: 100, correction: { ...def.correction } } })
}

function patchIntensity(value: number): void {
  const current = activeFilter.value
  if (!current?.preset) {
    return
  }
  const def = getPhotoFilterPresetDef(current.preset)
  const clamped = Math.min(100, Math.max(0, value))
  const correction = lerpCorrection(PHOTO_CORRECTION_NEUTRAL, def.correction, clamped / 100)
  patchElement({ filter: { preset: current.preset, intensity: clamped, correction } })
}

function getCorrectionValue(key: keyof PhotoCorrectionParams): number {
  return activeFilter.value?.correction[key] ?? PHOTO_CORRECTION_NEUTRAL[key]
}

function patchCorrection(key: keyof PhotoCorrectionParams, value: number): void {
  const current = activeFilter.value
  const correction = { ...(current?.correction ?? PHOTO_CORRECTION_NEUTRAL), [key]: value }
  patchElement({
    filter: { preset: current?.preset ?? null, intensity: current?.intensity ?? 100, correction },
  })
}

function patchOpacity(percent: number): void {
  const clamped = Math.min(100, Math.max(0, percent))
  patchElement({ opacity: clamped / 100 })
}

function resetFilter(): void {
  patchElement({ filter: null })
}

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-photo-filters-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-photo-filters-screen__presets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-photo-filters-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: $spacing-1;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.editor-photo-filters-screen__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid pp.$border;
  border-radius: $radius-sm;
  background: $white;
  overflow: hidden;
  transition: border-color 0.12s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .editor-photo-filters-screen__card:hover & {
    border-color: pp.$border-strong;
  }
}

.editor-photo-filters-screen__card--active .editor-photo-filters-screen__thumb {
  border-color: pp.$accent;
  border-width: 2px;
  background: pp.$accent-tint;
}

.editor-photo-filters-screen__check {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ffffff;
  background: pp.$accent;
  border-radius: 50%;
  padding: 1px;
}

.editor-photo-filters-screen__label {
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-photo-filters-screen__card--active .editor-photo-filters-screen__label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}

.editor-photo-filters-screen__correction {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-photo-filters-screen__section-title {
  margin: 0;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.editor-photo-filters-screen__row {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.editor-photo-filters-screen__row-label {
  font-size: $font-size-body-sm;
  color: pp.$ink-soft;
}

.editor-photo-filters-screen__row-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: $spacing-2;
  align-items: center;

  // color="primary" alone renders black — Vuetify's .v-theme--light class re-declares the theme
  // variables on the component itself, beating an inherited override from .editor-properties.
  :deep(.v-slider-track__fill) {
    background-color: pp.$accent !important;
  }

  :deep(.v-slider-thumb__surface) {
    color: pp.$accent !important;
  }
}

.editor-photo-filters-screen__row-input {
  :deep(.v-field) {
    font-size: $font-size-body-sm;
  }
}

.editor-photo-filters-screen__reset {
  margin-top: $spacing-2;
}
</style>
