<template>
  <BaseModal :model-value="open" labelledby="incomplete-photos-title" narrow @update:model-value="handleOverlayUpdate">
    <div class="incomplete-photos">
      <div class="incomplete-photos__icon" aria-hidden="true">
        <v-icon size="28" color="white">mdi-image-off-outline</v-icon>
      </div>

      <h2 id="incomplete-photos-title" class="incomplete-photos__title">Остались пустые места</h2>
      <ul class="incomplete-photos__list">
        <li v-for="page in pages" :key="page.journalPageId">
          <button type="button" class="incomplete-photos__item" @click="emit('select', page.journalPageId)">
            {{ missingPhotoLine(page.pageLabel, page.slots.length) }}
            <v-icon size="16">mdi-chevron-right</v-icon>
          </button>
        </li>
      </ul>
      <p v-if="variant === 'continue'" class="incomplete-photos__subtitle">
        Можно вернуться и выбрать фото сейчас или загрузить их позже, до проверки заказа.
      </p>

      <div class="incomplete-photos__actions">
        <template v-if="variant === 'continue'">
          <v-btn color="primary" variant="flat" size="large" block @click="emit('close')">
            Вернуться и загрузить фото
          </v-btn>
          <v-btn variant="text" size="large" block @click="emit('later')">Загружу позже</v-btn>
        </template>
        <v-btn v-else-if="variant === 'upload'" color="primary" variant="flat" size="large" block @click="emit('upload')">
          Загрузить фото
        </v-btn>
        <v-btn v-else color="primary" variant="flat" size="large" block @click="emit('close')">Понятно</v-btn>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'
import { missingPhotoLine } from '../utils/missing-photos.util'
import type { PhotoSlotPreviewPage } from '../utils/missing-photos.util'

defineProps<{
  open: boolean
  pages: PhotoSlotPreviewPage[]
  /** `continue` — leaving the photo step. `notice` — the photo-step counter. `upload` — a later
   * step's mobile badge, whose actions send the visitor back to the photo step. */
  variant: 'continue' | 'notice' | 'upload'
}>()

const emit = defineEmits<{
  close: []
  select: [journalPageId: string]
  later: []
  upload: []
}>()

function handleOverlayUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}
</script>

<style scoped lang="scss">
.incomplete-photos {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  width: min(100%, 400px);
  margin-inline: auto;
  padding-top: $spacing-2;
  text-align: center;
}

.incomplete-photos__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background: $accent;
}

.incomplete-photos__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.incomplete-photos__list {
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.incomplete-photos__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  width: 100%;
  padding: $spacing-3 0;
  border: none;
  border-bottom: 1px solid $border-light;
  background: none;
  color: $text-primary;
  font-size: $font-size-body-sm;
  text-align: left;
  cursor: pointer;
}

.incomplete-photos__subtitle {
  margin: 0;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
}

.incomplete-photos__actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  width: 100%;
  margin-top: $spacing-2;

  .v-btn {
    text-transform: none;
  }
}
</style>
