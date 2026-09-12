<template>
  <BaseModal
    :model-value="open"
    labelledby="resume-draft-modal-title"
    @update:model-value="emit('close')"
  >
    <div class="resume-draft">
      <h2 id="resume-draft-modal-title" class="resume-draft__title">
        {{ mode === 'guest' ? 'У вас есть незаконченный журнал' : 'У вас есть незаконченные журналы' }}
      </h2>
      <p class="resume-draft__subtitle">
        Хотите продолжить редактирование или начать новый?
      </p>

      <div class="resume-draft__list">
        <template v-if="mode === 'guest'">
          <article v-if="guestDraft" class="resume-draft__card">
            <div class="resume-draft__cover">
              <JournalSpreadThumbnail
                v-if="guestCoverCanvas"
                :canvas-data="guestCoverCanvas"
                :container-ratio="0.75"
              />
              <div v-else class="resume-draft__cover-placeholder" />
            </div>
            <div class="resume-draft__body">
              <h3 class="resume-draft__name">{{ guestDraft.order.magazineType.name }}</h3>
              <p class="resume-draft__meta">Сохранено {{ formatDate(guestDraft.savedAt) }}</p>
            </div>
            <v-btn color="primary" size="small" class="resume-draft__continue" @click="emit('continue')">
              Продолжить
            </v-btn>
          </article>
        </template>

        <template v-else>
          <article v-for="draft in drafts" :key="draft.id" class="resume-draft__card">
            <div class="resume-draft__cover">
              <JournalSpreadThumbnail
                v-if="coverCanvas(draft)"
                :canvas-data="coverCanvas(draft)!"
                :container-ratio="0.75"
              />
              <div v-else class="resume-draft__cover-placeholder" />
            </div>
            <div class="resume-draft__body">
              <h3 class="resume-draft__name">{{ draft.magazineType.name }}</h3>
              <p class="resume-draft__meta">Изменено {{ formatDate(draft.updatedAt) }}</p>
            </div>
            <v-btn color="primary" size="small" class="resume-draft__continue" @click="emit('continue', draft.id)">
              Продолжить
            </v-btn>
          </article>
        </template>
      </div>

      <v-btn
        variant="outlined"
        color="secondary"
        class="resume-draft__start-new"
        @click="emit('startNew')"
      >
        Начать новый журнал
      </v-btn>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import type { OrderSummary, PlaceholderValue } from '../types/order.types'
import type { StoredLocalDraft } from '../utils/local-draft-storage.util'

const props = defineProps<{
  open: boolean
  mode: 'authenticated' | 'guest'
  drafts: OrderSummary[]
  guestDraft: StoredLocalDraft | null
}>()

const emit = defineEmits<{
  continue: [orderId?: string]
  startNew: []
  close: []
}>()

function coverOf(page: { pageSnapshot: CanvasData; placeholderValues: PlaceholderValue[] } | undefined): CanvasData | null {
  if (!page) {
    return null
  }
  return materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues)
}

function coverCanvas(order: OrderSummary): CanvasData | null {
  return coverOf(order.journalPages[0])
}

const guestCoverCanvas = computed(() => coverOf(props.guestDraft?.order.journalPages[0]))

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped lang="scss">
.resume-draft {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.resume-draft__title {
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
  margin: 0 0 $spacing-2;
  text-align: center;
}

.resume-draft__subtitle {
  font-size: $font-size-body-sm;
  color: $text-secondary;
  text-align: center;
  margin: 0 0 $spacing-6;
}

.resume-draft__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  margin-bottom: $spacing-6;
  max-height: 320px;
  overflow-y: auto;
}

.resume-draft__card {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-3;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
}

.resume-draft__cover {
  position: relative;
  width: 64px;
  aspect-ratio: 3 / 4;
  flex-shrink: 0;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-tertiary;
}

.resume-draft__cover-placeholder {
  position: absolute;
  inset: 0;
  background: $bg-tertiary;
}

.resume-draft__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resume-draft__name {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resume-draft__meta {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.resume-draft__continue {
  flex-shrink: 0;
  text-transform: none;
}

.resume-draft__start-new {
  width: 100%;
  text-transform: none;
}
</style>
