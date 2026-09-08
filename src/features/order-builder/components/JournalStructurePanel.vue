<template>
  <aside class="journal-structure" aria-label="Структура журнала">
    <div class="journal-structure__header">
      <p class="journal-structure__eyebrow">Структура</p>
      <h2 class="journal-structure__title">{{ store.order?.magazineType.name ?? 'Журнал' }}</h2>
      <p class="journal-structure__hint">{{ spreadCount }} разворотов</p>
    </div>

    <v-alert v-if="store.orderError" type="error" variant="tonal" density="compact" class="journal-structure__alert">
      {{ store.orderError }}
    </v-alert>

    <div class="journal-structure__list">
      <div
        v-for="entry in sidebarEntries"
        :key="entry.page.id"
        class="journal-structure__row"
        :class="{ 'journal-structure__row--dragging': draggingSpreadId === entry.page.id }"
        :draggable="entry.draggable"
        @dragstart="entry.draggable ? onDragStart(entry.page.id) : undefined"
        @dragover.prevent
        @drop="entry.draggable ? onDrop(entry.page.id) : undefined"
        @dragend="draggingSpreadId = null"
      >
        <button
          type="button"
          class="journal-structure__item"
          :class="{ 'journal-structure__item--active': entry.page.id === activeJournalPageId }"
          @click="navigateToPage(entry.page.id)"
        >
          <span v-if="entry.draggable" class="journal-structure__drag" aria-hidden="true">
            <v-icon size="16">mdi-drag-vertical</v-icon>
          </span>

          <span class="journal-structure__index">{{ entry.label }}</span>

          <div class="journal-structure__meta">
            <span class="journal-structure__name">{{ entry.templateLabel }}</span>
            <span v-if="entry.layoutHint" class="journal-structure__type">{{ entry.layoutHint }}</span>
          </div>

          <v-icon v-if="isPageComplete(entry.page)" size="16" color="success">mdi-check-circle</v-icon>
        </button>

        <v-btn
          icon="mdi-palette-outline"
          size="x-small"
          variant="text"
          aria-label="Выбрать шаблон"
          @click.stop="openTemplatePicker(entry.page.id)"
        />
      </div>
    </div>

    <div class="journal-structure__footer">
      <v-btn
        block
        variant="outlined"
        size="small"
        prepend-icon="mdi-plus"
        :disabled="store.isSaving"
        @click="handleAddSpread"
      >
        Добавить разворот
      </v-btn>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>

    <JournalTemplatePickerDialog
      :open="templatePicker.open"
      :journal-page="templatePicker.page"
      :templates="store.groupedTemplates"
      :loading="store.isSaving"
      @close="closeTemplatePicker"
      @apply="handleApplyTemplate"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import { isFillableElement, isPlaceholderFilled } from '../utils/placeholder.utils'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import type { SetJournalPageTemplatePayload } from '../api/orders.api'
import type { JournalPage } from '../types/order.types'
import JournalTemplatePickerDialog from './JournalTemplatePickerDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useOrderBuilderStore()
const editorStore = useEditorStore()

const activeJournalPageId = computed(() => route.params.journalPageId as string)

const draggingSpreadId = ref<string | null>(null)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
}>({
  open: false,
  page: null,
})

const spreadCount = computed(
  () => store.order?.journalPages.filter((page) => page.slotType === 'SPREAD').length ?? 0,
)

const sidebarEntries = computed(() => {
  const pages = store.order?.journalPages ?? []
  let spreadNumber = 0

  return pages.map((page) => {
    const isSpread = page.slotType === 'SPREAD'
    if (isSpread) {
      spreadNumber += 1
    }

    const label = isSpread ? String(spreadNumber) : page.slotType === 'COVER' ? 'О' : 'З'

    const templateLabel =
      page.slotType === 'SPREAD' && page.layoutMode === 'SPLIT_PAGES'
        ? `${page.magazinePage.name} + ${page.rightMagazinePage?.name ?? '—'}`
        : page.magazinePage.name

    const layoutHint =
      page.slotType === 'SPREAD'
        ? page.layoutMode === 'SPLIT_PAGES'
          ? '2 страницы'
          : 'Разворот'
        : getJournalPageDisplayName(page)

    return {
      page,
      label,
      templateLabel,
      layoutHint: page.slotType === 'SPREAD' ? layoutHint : undefined,
      draggable: isSpread,
    }
  })
})

/** Required-field completeness — falls back to the element's own `defaultText`/`defaultImageUrl`
 * when there's no separate placeholder value, so this reads correctly whether the page was filled
 * via the (now removed) simple mode or baked directly into pageSnapshot by the advanced editor. */
function isPageComplete(page: JournalPage): boolean {
  const canvas = page.pageSnapshot as CanvasData
  const values = new Map(page.placeholderValues.map((item) => [item.elementId, item]))

  const required = canvas.elements.filter((element: PageElement) => {
    if (!isFillableElement(element)) {
      return false
    }

    return Boolean((element as { required?: boolean }).required)
  })

  if (required.length === 0) {
    return true
  }

  return required.every((element) => isPlaceholderFilled(element, values.get(element.id)))
}

/** Flushes the currently open page's unsaved edits before leaving it — explicit, rather than
 * relying on the outgoing page's onUnmounted flush racing the incoming page's fetch. */
async function flushCurrentEditor(): Promise<void> {
  if (editorStore.isDirty) {
    await editorStore.saveCanvas()
  }
}

async function navigateToPage(journalPageId: string): Promise<void> {
  if (journalPageId === activeJournalPageId.value || !store.order) {
    return
  }

  try {
    await flushCurrentEditor()
    await router.push({
      name: 'journal-page-editor',
      params: { orderId: store.order.id, journalPageId },
    })
  } catch {
    snackbar.text = 'Не удалось сохранить страницу'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

function openTemplatePicker(journalPageId: string): void {
  const page = store.order?.journalPages.find((item) => item.id === journalPageId) ?? null
  templatePicker.page = page
  templatePicker.open = Boolean(page)
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    closeTemplatePicker()
    snackbar.text = 'Шаблон применён'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось применить шаблон'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function handleAddSpread(): Promise<void> {
  try {
    await store.addJournalSpread()
    snackbar.text = 'Разворот добавлен'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось добавить разворот'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

function onDragStart(spreadId: string): void {
  draggingSpreadId.value = spreadId
}

async function onDrop(targetSpreadId: string): Promise<void> {
  const sourceId = draggingSpreadId.value
  draggingSpreadId.value = null

  if (!sourceId || sourceId === targetSpreadId) {
    return
  }

  const spreadIds = (store.order?.journalPages ?? [])
    .filter((page) => page.slotType === 'SPREAD')
    .map((page) => page.id)

  const fromIndex = spreadIds.indexOf(sourceId)
  const toIndex = spreadIds.indexOf(targetSpreadId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const next = [...spreadIds]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)

  try {
    await store.reorderJournalSpreads(next)
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось изменить порядок'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

</script>

<style scoped lang="scss">
.journal-structure {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.journal-structure__header {
  padding: $spacing-4 $spacing-4 $spacing-3;
  border-bottom: 1px solid $border-light;
}

.journal-structure__eyebrow {
  margin: 0 0 2px;
  font-size: $font-size-caption;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: $letter-spacing-caption;
}

.journal-structure__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.journal-structure__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.journal-structure__alert {
  margin: $spacing-3 $spacing-4 0;
}

.journal-structure__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-3 $spacing-4;
}

.journal-structure__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: $spacing-1;

  &--dragging {
    opacity: 0.55;
  }
}

.journal-structure__item {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: $spacing-2;
  width: 100%;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;

  &--active {
    border-color: $text-primary;
    background: $bg-primary;
  }
}

.journal-structure__drag {
  color: $text-muted;
  cursor: grab;
}

.journal-structure__index {
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: $bg-muted;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-caption;
  color: $text-secondary;
}

.journal-structure__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.journal-structure__name {
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.journal-structure__type {
  font-size: $font-size-caption;
  color: $text-muted;
}

.journal-structure__footer {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-3 $spacing-4 $spacing-4;
  border-top: 1px solid $border-light;
}
</style>
