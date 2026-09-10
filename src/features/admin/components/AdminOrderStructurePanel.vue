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
        <div class="admin-order-structure__card">
          <div class="admin-order-structure__thumb">
            <JournalSpreadThumbnail :canvas-data="materializedCanvas(entry.page)" :container-ratio="1.19" />
          </div>

          <div class="admin-order-structure__meta-row">
            <span class="admin-order-structure__index">{{ entry.label }}</span>
            <span class="admin-order-structure__name">{{ entry.templateLabel }}</span>
            <span
              class="admin-order-structure__status"
              :class="{ 'admin-order-structure__status--done': isPageComplete(entry.page) }"
            >
              <v-icon v-if="isPageComplete(entry.page)" size="10" color="white">mdi-check</v-icon>
            </span>
          </div>
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
import type { PageElement } from '@/modules/editor/models'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import { isFillableElement, isPlaceholderFilled } from '@/features/order-builder/utils/placeholder.utils'
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

    // Always set, not just for SPREAD — the subtitle line under the name is a second row in every
    // card's height now, so leaving it empty for covers/back-covers made just those cards shorter
    // than the rest. `page.slotType` is a plain `string` here (see `AdminOrderJournalPage`), so
    // this mirrors — rather than reuses — the customer-facing sidebar's `JOURNAL_SLOT_LABELS` text.
    const layoutHint = isSpread
      ? page.layoutMode === 'SPLIT_PAGES'
        ? '2 страницы'
        : 'Разворот'
      : page.slotType === 'COVER'
        ? 'Обложка'
        : 'Задняя обложка'

    return { page, label, templateLabel, layoutHint }
  })
})

/** Bakes saved placeholder-value diffs into the page's own document — same materialization the
 * advanced editor uses — so the row thumbnail reflects what's actually placed, not just the bare
 * template. */
function materializedCanvas(page: AdminOrderJournalPage): CanvasData {
  return materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues)
}

/** Required-field completeness — mirrors the customer-facing `JournalStructurePanel.vue`, so an
 * admin reviewing an order can see at a glance which spreads still need content. */
function isPageComplete(page: AdminOrderJournalPage): boolean {
  const canvas = normalizeCanvasData(page.pageSnapshot)
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
  // Default `stretch` forces every card to the row track's height — harmless once that height is
  // correct, but `<JournalSpreadThumbnail>` renders one frame at `height: 0` before its own
  // `ResizeObserver` callback measures a real width and corrects it (see `containerRatio` prop),
  // and a stretched card can end up locked to that first, too-short measurement with `overflow:
  // hidden` then clipping it. `start` lets each card keep its own full natural height instead.
  align-items: start;
  gap: 20px 10px;
  padding: $spacing-3 $spacing-4;
}

.admin-order-structure__row {
  // Deliberately no border/overflow/radius here — those live on `.admin-order-structure__card`
  // below instead. `overflow` other than `visible` on a *grid item* zeroes out its "automatic
  // minimum size" contribution to the row's `auto`-track sizing (a real CSS Grid/box-sizing rule,
  // not a rendering bug) — Grid then has no guaranteed floor for this row's height and can lock it
  // to whatever height `<JournalSpreadThumbnail>` happens to report on its very first
  // (pre-measurement) frame, which is 0. Moving the clipping to a plain, non-grid-item child
  // sidesteps that rule entirely.
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;

  &:focus-visible .admin-order-structure__card {
    outline: 2px solid $accent;
    outline-offset: 2px;
  }

  &--active .admin-order-structure__card {
    border-color: $accent;
    box-shadow: 0 0 0 1px $accent;
  }
}

.admin-order-structure__card {
  border: 1px solid $border-default;
  border-radius: $radius-md;
  overflow: hidden;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;

  .admin-order-structure__row:hover & {
    border-color: $border-strong;
  }
}

.admin-order-structure__thumb {
  // No width/height/ratio CSS here on purpose — `<JournalSpreadThumbnail container-ratio="1.19">`
  // measures its own width via JS and sets its height as an explicit pixel value — a second layer
  // of defense alongside moving `overflow` off the grid item itself (see `.admin-order-structure__row`'s
  // comment for the actual root cause).
  position: relative;
  background: $bg-muted;
}

.admin-order-structure__meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: $spacing-2 $spacing-2 0;
}

.admin-order-structure__index {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: $text-primary;
  color: $white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  font-weight: $font-weight-medium;
}

.admin-order-structure__name {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-order-structure__status {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  border-radius: 999px;
  border: 1.5px solid $border-strong;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &--done {
    border-color: $accent;
    background: $accent;
    color: $white;
  }
}

.admin-order-structure__type {
  display: block;
  padding: 2px $spacing-2 $spacing-2 31px;
  font-size: 10.5px;
  color: $text-muted;
}
</style>
