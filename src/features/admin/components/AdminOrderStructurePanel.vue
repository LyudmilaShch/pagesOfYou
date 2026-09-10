<template>
  <aside class="admin-order-structure" aria-label="Структура журнала">
    <div class="admin-order-structure__header">
      <p class="admin-order-structure__eyebrow">Структура</p>
      <h2 class="admin-order-structure__title">{{ store.current?.magazineType.name ?? 'Журнал' }}</h2>
      <p class="admin-order-structure__hint">{{ spreadCount }} разворотов</p>
    </div>

    <div class="admin-order-structure__list">
      <button
        v-for="entry in sidebarEntries"
        :key="entry.page.id"
        type="button"
        class="admin-order-structure__row"
        :class="{ 'admin-order-structure__row--active': entry.page.id === activeJournalPageId }"
        @click="navigateToPage(entry.page.id)"
      >
        <div class="admin-order-structure__thumb">
          <JournalSpreadThumbnail :canvas-data="materializedCanvas(entry.page)" />
          <span class="admin-order-structure__thumb-index">{{ entry.label }}</span>
        </div>

        <div class="admin-order-structure__meta">
          <span class="admin-order-structure__name">{{ entry.templateLabel }}</span>
          <span v-if="entry.layoutHint" class="admin-order-structure__type">{{ entry.layoutHint }}</span>
        </div>
      </button>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import { useAdminOrdersStore } from '../stores/orders.store'
import type { AdminOrderJournalPage } from '@/shared/api/admin/orders.api'

const route = useRoute()
const router = useRouter()
const store = useAdminOrdersStore()
const editorStore = useEditorStore()

const activeJournalPageId = computed(() => route.params.journalPageId as string)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

const spreadCount = computed(
  () => store.current?.journalPages.filter((page) => page.slotType === 'SPREAD').length ?? 0,
)

const sidebarEntries = computed(() => {
  const pages = store.current?.journalPages ?? []
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

    const layoutHint = isSpread ? (page.layoutMode === 'SPLIT_PAGES' ? '2 страницы' : 'Разворот') : undefined

    return { page, label, templateLabel, layoutHint }
  })
})

/** Bakes saved placeholder-value diffs into the page's own document — same materialization the
 * advanced editor uses — so the row thumbnail reflects what's actually placed, not just the bare
 * template. */
function materializedCanvas(page: AdminOrderJournalPage): CanvasData {
  return materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues)
}

/** Flushes the currently open page's unsaved edits before leaving it, mirroring the customer-facing
 * `JournalStructurePanel.vue` — explicit, rather than relying on the outgoing page's onUnmounted
 * flush racing the incoming page's fetch. */
async function flushCurrentEditor(): Promise<void> {
  if (editorStore.isDirty) {
    await editorStore.saveCanvas()
  }
}

async function navigateToPage(journalPageId: string): Promise<void> {
  if (journalPageId === activeJournalPageId.value || !store.current) {
    return
  }

  try {
    await flushCurrentEditor()
    await router.push({
      name: 'admin-order-journal-page-editor',
      params: { orderId: store.current.id, journalPageId },
    })
  } catch {
    snackbar.text = 'Не удалось сохранить страницу'
    snackbar.color = 'error'
    snackbar.show = true
  }
}
</script>

<style scoped lang="scss">
.admin-order-structure {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.admin-order-structure__header {
  padding: $spacing-4 $spacing-4 $spacing-3;
  border-bottom: 1px solid $border-light;
}

.admin-order-structure__eyebrow {
  margin: 0 0 2px;
  font-size: $font-size-caption;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: $letter-spacing-caption;
}

.admin-order-structure__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.admin-order-structure__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.admin-order-structure__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  align-content: start;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
}

.admin-order-structure__row {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;

  &--active .admin-order-structure__thumb {
    border-color: $text-primary;
    box-shadow: 0 0 0 2px $bg-primary;
  }
}

.admin-order-structure__thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1.4;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;
  border: 1px solid $border-light;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.admin-order-structure__thumb-index {
  position: absolute;
  bottom: $spacing-1;
  left: $spacing-1;
  z-index: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: $white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  line-height: 1;
}

.admin-order-structure__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 0 2px;
}

.admin-order-structure__name {
  font-size: $font-size-caption;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-order-structure__type {
  font-size: 10px;
  color: $text-muted;
}
</style>
