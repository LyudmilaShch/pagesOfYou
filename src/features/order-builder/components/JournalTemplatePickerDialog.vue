<template>
  <v-dialog :model-value="open" max-width="720" @update:model-value="handleClose">
    <v-card>
      <v-card-title>Выбор шаблона</v-card-title>
      <v-card-subtitle>{{ slotLabel }}</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <v-btn-toggle
          v-if="journalPage?.slotType === 'SPREAD'"
          v-model="layoutMode"
          mandatory
          color="primary"
          class="journal-template-picker__layout-toggle mb-4"
        >
          <v-btn value="SPREAD" size="small">Целый разворот</v-btn>
          <v-btn value="SPLIT_PAGES" size="small">Каждая страница</v-btn>
        </v-btn-toggle>

        <template v-if="journalPage?.slotType === 'SPREAD' && layoutMode === 'SPLIT_PAGES'">
          <p class="journal-template-picker__section-title">Левая страница</p>
          <div class="journal-template-picker__grid mb-4">
            <button
              v-for="template in templates.page"
              :key="`left-${template.id}`"
              type="button"
              class="journal-template-picker__item"
              :class="{ 'journal-template-picker__item--active': selectedLeftId === template.id }"
              @click="selectedLeftId = template.id"
            >
              <div
                class="journal-template-picker__preview"
                :style="{ aspectRatio: getTemplatePreviewAspectRatio(template.canvasData) }"
              >
                <img
                  v-if="template.previewImage"
                  :src="template.previewImage"
                  :alt="template.name"
                />
                <TemplateCanvasPreview v-else :canvas-data="template.canvasData" />
              </div>
              <span class="journal-template-picker__name">{{ template.name }}</span>
            </button>
          </div>

          <p class="journal-template-picker__section-title">Правая страница</p>
          <div class="journal-template-picker__grid">
            <button
              v-for="template in templates.page"
              :key="`right-${template.id}`"
              type="button"
              class="journal-template-picker__item"
              :class="{ 'journal-template-picker__item--active': selectedRightId === template.id }"
              @click="selectedRightId = template.id"
            >
              <div
                class="journal-template-picker__preview"
                :style="{ aspectRatio: getTemplatePreviewAspectRatio(template.canvasData) }"
              >
                <img
                  v-if="template.previewImage"
                  :src="template.previewImage"
                  :alt="template.name"
                />
                <TemplateCanvasPreview v-else :canvas-data="template.canvasData" />
              </div>
              <span class="journal-template-picker__name">{{ template.name }}</span>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="journal-template-picker__grid">
            <button
              v-for="template in activeTemplates"
              :key="template.id"
              type="button"
              class="journal-template-picker__item"
              :class="{ 'journal-template-picker__item--active': selectedSingleId === template.id }"
              @click="selectedSingleId = template.id"
            >
              <div
                class="journal-template-picker__preview"
                :style="{ aspectRatio: getTemplatePreviewAspectRatio(template.canvasData) }"
              >
                <img
                  v-if="template.previewImage"
                  :src="template.previewImage"
                  :alt="template.name"
                />
                <TemplateCanvasPreview v-else :canvas-data="template.canvasData" />
              </div>
              <span class="journal-template-picker__name">{{ template.name }}</span>
            </button>
          </div>
        </template>

        <v-alert
          v-if="activeTemplates.length === 0 && !(journalPage?.slotType === 'SPREAD' && layoutMode === 'SPLIT_PAGES' && templates.page.length > 0)"
          type="warning"
          variant="tonal"
          class="mt-4"
        >
          Для этого слота пока нет шаблонов в админке.
        </v-alert>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="handleClose(false)">Отмена</v-btn>
        <v-btn color="primary" :disabled="!canApply" :loading="loading" @click="handleApply">
          Применить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import TemplateCanvasPreview from './TemplateCanvasPreview.vue'
import type { CatalogMagazinePage } from '../api/catalog.api'
import type { SetJournalPageTemplatePayload } from '../api/orders.api'
import type { JournalSpreadLayout } from '../constants/journal.constants'
import type { JournalPage } from '../types/order.types'
import { getJournalPageDisplayName, type TemplateCatalog } from '../utils/journal-structure.util'
import { getTemplatePreviewAspectRatio } from '../utils/template-preview.util'

const props = defineProps<{
  open: boolean
  journalPage: JournalPage | null
  templates: TemplateCatalog
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: SetJournalPageTemplatePayload]
}>()

const layoutMode = ref<JournalSpreadLayout>('SPREAD')
const selectedSingleId = ref<string | null>(null)
const selectedLeftId = ref<string | null>(null)
const selectedRightId = ref<string | null>(null)

const slotLabel = computed(() => {
  if (!props.journalPage) {
    return ''
  }

  return getJournalPageDisplayName(props.journalPage)
})

const activeTemplates = computed((): CatalogMagazinePage[] => {
  if (!props.journalPage) {
    return []
  }

  if (props.journalPage.slotType === 'COVER') {
    return props.templates.cover
  }

  if (props.journalPage.slotType === 'BACK_COVER') {
    return props.templates.backCover
  }

  return props.templates.spread
})

const canApply = computed(() => {
  if (!props.journalPage) {
    return false
  }

  if (props.journalPage.slotType === 'SPREAD' && layoutMode.value === 'SPLIT_PAGES') {
    return Boolean(selectedLeftId.value && selectedRightId.value)
  }

  return Boolean(selectedSingleId.value)
})

watch(
  () => [props.open, props.journalPage] as const,
  ([open, page]) => {
    if (!open || !page) {
      return
    }

    layoutMode.value = page.layoutMode ?? 'SPREAD'
    selectedSingleId.value = page.magazinePage.id
    selectedLeftId.value = page.magazinePage.id
    selectedRightId.value = page.rightMagazinePage?.id ?? page.magazinePage.id
  },
  { immediate: true },
)

function handleClose(value: boolean): void {
  if (!value) {
    emit('close')
  }
}

function handleApply(): void {
  if (!props.journalPage || !canApply.value) {
    return
  }

  if (props.journalPage.slotType === 'SPREAD' && layoutMode.value === 'SPLIT_PAGES') {
    emit('apply', {
      layoutMode: 'SPLIT_PAGES',
      magazinePageId: selectedLeftId.value!,
      rightMagazinePageId: selectedRightId.value!,
    })
    return
  }

  emit('apply', {
    layoutMode: props.journalPage.slotType === 'SPREAD' ? 'SPREAD' : undefined,
    magazinePageId: selectedSingleId.value!,
  })
}
</script>

<style scoped lang="scss">
.journal-template-picker__layout-toggle {
  width: 100%;

  :deep(.v-btn) {
    flex: 1;
  }
}

.journal-template-picker__section-title {
  margin: 0 0 $spacing-3;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-secondary;
}

.journal-template-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: $spacing-3;
}

.journal-template-picker__item {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-2;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &--active {
    border-color: $text-primary;
    box-shadow: 0 0 0 1px $text-primary;
  }
}

.journal-template-picker__preview {
  position: relative;
  width: 100%;
  border-radius: $radius-sm;
  background: $bg-muted;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.journal-template-picker__name {
  font-size: $font-size-caption;
  line-height: 1.3;
  color: $text-primary;
}
</style>
