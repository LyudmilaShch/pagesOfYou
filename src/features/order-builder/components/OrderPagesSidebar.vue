<template>
  <aside class="order-pages-sidebar">
    <div class="order-pages-sidebar__header">
      <h3 class="order-pages-sidebar__title">Структура журнала</h3>
      <span class="order-pages-sidebar__count">{{ spreadCount }} разворотов</span>
    </div>

    <div class="order-pages-sidebar__list">
      <div
        v-for="entry in sidebarEntries"
        :key="entry.page.id"
        class="order-pages-sidebar__row"
        :class="{
          'order-pages-sidebar__row--dragging': draggingSpreadId === entry.page.id,
        }"
        :draggable="entry.draggable"
        @dragstart="entry.draggable ? onDragStart(entry.page.id) : undefined"
        @dragover.prevent
        @drop="entry.draggable ? onDrop(entry.page.id) : undefined"
        @dragend="draggingSpreadId = null"
      >
        <button
          type="button"
          class="order-pages-sidebar__item"
          :class="{ 'order-pages-sidebar__item--active': entry.index === currentIndex }"
          @click="emit('select', entry.index)"
        >
          <span v-if="entry.draggable" class="order-pages-sidebar__drag" aria-hidden="true">
            <v-icon size="16">mdi-drag-vertical</v-icon>
          </span>

          <span class="order-pages-sidebar__index">{{ entry.label }}</span>

          <div class="order-pages-sidebar__meta">
            <span class="order-pages-sidebar__name">{{ entry.templateLabel }}</span>
            <span v-if="entry.layoutHint" class="order-pages-sidebar__type">{{ entry.layoutHint }}</span>
          </div>

          <v-icon v-if="isPageComplete(entry.page)" size="16" color="success">mdi-check-circle</v-icon>
        </button>

        <v-btn
          icon="mdi-palette-outline"
          size="x-small"
          variant="text"
          aria-label="Выбрать шаблон"
          @click.stop="emit('pick-template', entry.page.id)"
        />
      </div>
    </div>

    <v-btn
      block
      variant="outlined"
      size="small"
      prepend-icon="mdi-plus"
      class="order-pages-sidebar__add"
      @click="emit('add-spread')"
    >
      Добавить разворот
    </v-btn>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import { isFillableElement } from '../utils/placeholder.utils'
import type { JournalPage } from '../types/order.types'

const props = defineProps<{
  pages: JournalPage[]
  currentIndex: number
}>()

const emit = defineEmits<{
  select: [index: number]
  'pick-template': [journalPageId: string]
  'add-spread': []
  reorder: [spreadIds: string[]]
}>()

const draggingSpreadId = ref<string | null>(null)

const spreadCount = computed(
  () => props.pages.filter((page) => page.slotType === 'SPREAD').length,
)

const sidebarEntries = computed(() => {
  let spreadNumber = 0

  return props.pages.map((page, index) => {
    const isSpread = page.slotType === 'SPREAD'
    if (isSpread) {
      spreadNumber += 1
    }

    const label = isSpread
      ? String(spreadNumber)
      : page.slotType === 'COVER'
        ? 'О'
        : 'З'

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
      index,
      label,
      templateLabel,
      layoutHint: page.slotType === 'SPREAD' ? layoutHint : undefined,
      draggable: isSpread,
    }
  })
})

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

  return required.every((element) => {
    const value = values.get(element.id)

    if (element.type === 'photo-placeholder') {
      return Boolean(value?.jsonValue?.url?.trim())
    }

    return Boolean(value?.textValue?.trim())
  })
}

function onDragStart(spreadId: string): void {
  draggingSpreadId.value = spreadId
}

function onDrop(targetSpreadId: string): void {
  const sourceId = draggingSpreadId.value
  draggingSpreadId.value = null

  if (!sourceId || sourceId === targetSpreadId) {
    return
  }

  const spreadIds = props.pages
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

  emit('reorder', next)
}
</script>

<style scoped lang="scss">
.order-pages-sidebar {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  height: 100%;
  min-height: 0;
  padding: $spacing-4;
  border-right: 1px solid $border-light;
  background: $bg-primary;
  overflow-y: auto;
}

.order-pages-sidebar__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-2;
  margin-bottom: $spacing-2;
}

.order-pages-sidebar__title {
  margin: 0;
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

.order-pages-sidebar__count {
  font-size: $font-size-caption;
  color: $text-muted;
}

.order-pages-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.order-pages-sidebar__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: $spacing-1;

  &--dragging {
    opacity: 0.55;
  }
}

.order-pages-sidebar__item {
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

.order-pages-sidebar__drag {
  color: $text-muted;
  cursor: grab;
}

.order-pages-sidebar__index {
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

.order-pages-sidebar__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.order-pages-sidebar__name {
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-pages-sidebar__type {
  font-size: $font-size-caption;
  color: $text-muted;
}

.order-pages-sidebar__add {
  margin-top: $spacing-2;
}
</style>
