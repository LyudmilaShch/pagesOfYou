<template>
  <div class="mobile-page-bg">
    <p class="mobile-page-bg__block-title">Фон</p>

    <template v-if="store.isSpreadPage">
      <div class="mobile-page-bg__chip-pair" role="group" aria-label="Режим фона разворота">
        <button
          v-for="option in spreadBackgroundModeOptions"
          :key="option.value"
          type="button"
          class="mobile-page-bg__chip-btn"
          :class="{ active: store.spreadBackgroundMode === option.value }"
          :aria-pressed="store.spreadBackgroundMode === option.value"
          @click="updateSpreadBackgroundMode(option.value)"
        >
          <v-icon size="13">{{ option.icon }}</v-icon>
          {{ option.shortTitle }}
        </button>
      </div>

      <div
        v-if="store.spreadBackgroundMode === 'per-page'"
        class="mobile-page-bg__chip-pair"
        role="tablist"
        aria-label="Страница для редактирования фона"
      >
        <button
          v-for="option in spreadBackgroundSideOptions"
          :key="option.value"
          type="button"
          role="tab"
          class="mobile-page-bg__chip-btn"
          :class="{ active: store.activeSpreadBackgroundSide === option.value }"
          :aria-selected="store.activeSpreadBackgroundSide === option.value"
          @click="updateActiveSpreadBackgroundSide(option.value)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="mobile-page-bg__side-icon">
            <rect
              x="3" y="5" width="8" height="14" rx="1"
              :fill="option.value === 'left' ? 'currentColor' : 'none'"
              :stroke="option.value === 'left' ? 'none' : 'currentColor'"
              :opacity="option.value === 'left' ? 1 : 0.35"
            />
            <rect
              x="13" y="5" width="8" height="14" rx="1"
              :fill="option.value === 'right' ? 'currentColor' : 'none'"
              :stroke="option.value === 'right' ? 'none' : 'currentColor'"
              :opacity="option.value === 'right' ? 1 : 0.35"
            />
          </svg>
          {{ option.shortTitle }}
        </button>
      </div>
      <p v-else class="mobile-page-bg__hint">Один фон на обе страницы</p>
    </template>

    <p class="mobile-page-bg__block-title">Цвет фона</p>
    <EditorColorPicker
      :model-value="editablePageBackground.backgroundColor"
      fallback="#FFFFFF"
      @update:model-value="updateBackgroundColor"
    />

    <div class="mobile-page-bg__image-row">
      <div v-if="editablePageBackground.backgroundImageUrl" class="mobile-page-bg__image-thumb">
        <img :src="pageBackgroundImagePreviewUrl" alt="" />
      </div>

      <button
        type="button"
        class="mobile-page-bg__upload-btn"
        :disabled="uploadingPageBackgroundImage"
        @click="triggerPageBackgroundInput"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
        {{ editablePageBackground.backgroundImageUrl ? 'Заменить' : 'Загрузить' }}
      </button>

      <button
        v-if="editablePageBackground.backgroundImageUrl"
        type="button"
        class="mobile-page-bg__icon-btn"
        :disabled="store.previewMode"
        aria-label="Кадрировать"
        title="Кадрировать"
        @click="handleStartPageBackgroundCrop"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2v14a2 2 0 002 2h14" /><path d="M18 22V8a2 2 0 00-2-2H2" /></svg>
      </button>

      <button
        v-if="editablePageBackground.backgroundImageUrl"
        type="button"
        class="mobile-page-bg__icon-btn mobile-page-bg__icon-btn--danger"
        aria-label="Удалить"
        title="Удалить"
        @click="removePageBackgroundImage"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
    </div>
    <input
      ref="pageBackgroundInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      @change="onPageBackgroundSelected"
    />

    <template v-if="editablePageBackground.backgroundImageUrl">
      <p class="mobile-page-bg__block-title">Масштабирование</p>
      <v-select
        class="mobile-page-bg__vselect"
        :model-value="editablePageBackground.backgroundImageFit"
        :items="pageBackgroundFitOptions"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="updatePageBackgroundFit"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useEditorStore } from '../store/editor.store'
import {
  PAGE_BACKGROUND_IMAGE_FIT_OPTIONS,
  SPREAD_BACKGROUND_MODE_OPTIONS,
  SPREAD_BACKGROUND_SIDE_OPTIONS,
} from '../models/page-background.model'
import type {
  PageBackgroundImageFit,
  SpreadBackgroundMode,
  SpreadBackgroundSide,
} from '../models/page-background.model'
import { uploadAdminImage } from '@/shared/api/admin/uploads.api'
import { resolveAssetUrl, toStoredAssetPath } from '@/shared/config/assets'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'
import EditorColorPicker from './EditorColorPicker.vue'

const store = useEditorStore()
const { showErrorMessageModal } = useErrorMessageModal()

const pageBackgroundFitOptions = PAGE_BACKGROUND_IMAGE_FIT_OPTIONS
const spreadBackgroundModeOptions = SPREAD_BACKGROUND_MODE_OPTIONS
const spreadBackgroundSideOptions = SPREAD_BACKGROUND_SIDE_OPTIONS
const editablePageBackground = computed(() => store.editablePageBackground)
const pageBackgroundImagePreviewUrl = computed(
  () => resolveAssetUrl(editablePageBackground.value.backgroundImageUrl) ?? '',
)

const pageBackgroundInputRef = ref<HTMLInputElement | null>(null)
const uploadingPageBackgroundImage = ref(false)

function updateSpreadBackgroundMode(value: SpreadBackgroundMode): void {
  store.setSpreadBackgroundMode(value)
}

function updateActiveSpreadBackgroundSide(value: SpreadBackgroundSide): void {
  store.setActiveSpreadBackgroundSide(value)
}

function updateBackgroundColor(value: string | null | undefined): void {
  if (!value?.trim()) {
    return
  }
  store.updatePageSettings({ backgroundColor: value.trim() })
}

function triggerPageBackgroundInput(): void {
  pageBackgroundInputRef.value?.click()
}

function removePageBackgroundImage(): void {
  store.stopPageBackgroundCropEditing()
  store.updatePageSettings({
    backgroundImageUrl: null,
    backgroundImageCropX: 0,
    backgroundImageCropY: 0,
    backgroundImageScale: 1,
  })
}

function handleStartPageBackgroundCrop(): void {
  store.startPageBackgroundCropEditing()
}

function updatePageBackgroundFit(value: PageBackgroundImageFit): void {
  store.updatePageSettings({ backgroundImageFit: value })
}

async function onPageBackgroundSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  uploadingPageBackgroundImage.value = true

  try {
    const { url } = await uploadAdminImage(file)
    store.updatePageSettings({
      backgroundImageUrl: toStoredAssetPath(url) ?? url,
      backgroundImageCropX: 0,
      backgroundImageCropY: 0,
      backgroundImageScale: 1,
    })
  } catch (error) {
    showErrorMessageModal(getUploadErrorMessage(error), 'Не удалось загрузить фоновое изображение')
  } finally {
    uploadingPageBackgroundImage.value = false
    input.value = ''
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.mobile-page-bg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.mobile-page-bg__block-title {
  margin: 8px 0 3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: pp.$ink-faint;

  &:first-child {
    margin-top: 0;
  }
}

.mobile-page-bg__hint {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  color: pp.$ink-soft;
}

.mobile-page-bg__chip-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 4px;
}

.mobile-page-bg__chip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: $white;
  color: pp.$ink;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;

  &.active {
    background: pp.$accent-tint;
    border-color: pp.$accent;
    color: pp.$accent-deep;
    font-weight: 600;
  }
}

.mobile-page-bg__side-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.mobile-page-bg__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-page-bg__vselect {
  :deep(.v-field) {
    border-radius: pp.$radius;
    min-height: 44px;
  }

  :deep(.v-field__input) {
    min-height: 44px;
    font-size: 14px;
  }
}

.mobile-page-bg__image-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.mobile-page-bg__image-thumb {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid pp.$border;
  overflow: hidden;
  background: repeating-linear-gradient(45deg, pp.$border 0 6px, $white 6px 12px);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.mobile-page-bg__upload-btn {
  flex: 1;
  min-width: 0;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid pp.$border-strong;
  border-radius: pp.$radius;
  background: $white;
  color: pp.$ink;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;

  svg {
    width: 13px;
    height: 13px;
    color: pp.$ink-soft;
    flex-shrink: 0;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.mobile-page-bg__icon-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid pp.$border-strong;
  border-radius: pp.$radius;
  background: $white;
  color: pp.$ink-soft;
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }

  &--danger {
    color: #b23b54;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
