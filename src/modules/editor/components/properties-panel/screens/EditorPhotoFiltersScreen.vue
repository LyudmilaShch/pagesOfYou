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

    <div class="editor-photo-filters-screen__correction">
      <p class="editor-photo-filters-screen__section-title">Пользовательские настройки</p>
      <EditorPhotoFilterSettingsForm
        :filter="displayFilter"
        :opacity-percent="opacityPercent"
        @patch-filter="patchFilter"
        @patch-opacity="patchOpacity"
        @reset="resetFilter"
      />
    </div>
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
} from '../../../models/photo-filter.model'
import type { PhotoFilter, PhotoFilterPresetKey } from '../../../models/photo-filter.model'
import type { PhotoPlaceholder } from '../../../models/photo-placeholder.model'
import { resolveAssetUrl } from '@/shared/config/assets'
import EditorPhotoFilterSettingsForm from '../EditorPhotoFilterSettingsForm.vue'

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

// EditorPhotoFilterSettingsForm needs a concrete PhotoFilter to bind to even before one exists —
// dragging any correction slider with no active filter starts one from scratch (preset: null),
// matching the original inline behavior these sliders always had.
const displayFilter = computed<PhotoFilter>(
  () => activeFilter.value ?? { preset: null, intensity: 100, correction: PHOTO_CORRECTION_NEUTRAL },
)

function patchFilter(partial: Partial<PhotoFilter>): void {
  const current = displayFilter.value
  patchElement({ filter: { ...current, ...partial } })
}

function patchOpacity(percent: number): void {
  const clamped = Math.min(100, Math.max(0, percent))
  patchElement({ opacity: clamped / 100 })
}

function resetFilter(): void {
  patchElement({ filter: null })
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

</style>
