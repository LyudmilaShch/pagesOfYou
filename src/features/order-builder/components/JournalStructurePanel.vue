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
        :class="{
          'journal-structure__row--dragging': draggingSpreadId === entry.page.id,
          'journal-structure__row--drag-over':
            dragOverSpreadId === entry.page.id && draggingSpreadId !== entry.page.id,
          'journal-structure__row--active': entry.page.id === activeJournalPageId,
        }"
        :data-spread-id="entry.page.id"
        :draggable="entry.draggable"
        role="button"
        tabindex="0"
        @click="navigateToPage(entry.page.id)"
        @keydown.enter="navigateToPage(entry.page.id)"
        @dragstart="entry.draggable ? onDragStart(entry.page.id) : undefined"
        @dragover.prevent
        @drop="entry.draggable ? onDrop(entry.page.id) : undefined"
        @dragend="draggingSpreadId = null"
      >
        <div class="journal-structure__card">
          <div class="journal-structure__thumb">
            <JournalSpreadThumbnail :canvas-data="materializedCanvas(entry.page)" :container-ratio="1.19" />

            <v-tooltip v-if="!isPageComplete(entry.page)" location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <span v-bind="tooltipProps" class="journal-structure__incomplete-badge" aria-label="Не заполнены обязательные поля">
                  <v-icon size="14" color="white">mdi-exclamation</v-icon>
                </span>
              </template>
              Не заполнены обязательные поля
            </v-tooltip>

            <span
              v-if="entry.draggable"
              class="journal-structure__drag"
              aria-hidden="true"
              @pointerdown="handleDragHandlePointerDown($event, entry.page.id)"
              @click.stop
            >
              <v-icon size="14" color="primary">mdi-drag-vertical</v-icon>
            </span>

            <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  icon="mdi-view-grid-outline"
                  size="small"
                  variant="text"
                  color="primary"
                  class="journal-structure__template-btn"
                  aria-label="Выбрать шаблон"
                  @click.stop="openTemplatePicker(entry.page.id)"
                />
              </template>
              Выбрать шаблон
            </v-tooltip>
          </div>

          <div class="journal-structure__meta-row">
            <span class="journal-structure__index">{{ entry.label }}</span>
            <span class="journal-structure__name">{{ entry.templateLabel }}</span>
            <span
              class="journal-structure__status"
              :class="{ 'journal-structure__status--done': isPageComplete(entry.page) }"
            >
              <v-icon v-if="isPageComplete(entry.page)" size="10" color="white">mdi-check</v-icon>
            </span>
          </div>
          <span v-if="entry.layoutHint" class="journal-structure__type">{{ entry.layoutHint }}</span>
        </div>
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
        Добавить 4 страницы
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
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import { isFillableElement, isPlaceholderFilled } from '../utils/placeholder.utils'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
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
const dragOverSpreadId = ref<string | null>(null)

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
      // Always set (not just for SPREAD, unlike the old sidebar which only showed this for
      // spreads) — the subtitle line under the name is a second row in every card's height now,
      // so leaving it empty for covers/back-covers made just those cards shorter than the rest.
      layoutHint,
      draggable: isSpread,
    }
  })
})

/** Bakes saved placeholder-value diffs into the page's own document — same materialization the
 * advanced editor uses — so the row thumbnail reflects what's actually placed, not just the bare
 * template. */
function materializedCanvas(page: JournalPage): CanvasData {
  return materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues)
}

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
    // Adds 2 spreads (4 pages) at once — see order-builder.store.ts's addJournalSpread doc comment.
    await store.addJournalSpread()
    snackbar.text = '4 страницы добавлены'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось добавить страницы'
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
  dragOverSpreadId.value = null

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

// Native HTML5 drag-and-drop (draggable/@dragstart/@dragover/@drop above) only fires from a
// mouse — most mobile browsers never start a native drag from a touch gesture at all. This is a
// parallel, Pointer Events-based path for touch/pen input on the same handle; mouse pointers fall
// through to the native path unchanged (mirrors EditorLayerNode.vue's reorder handle).
function findRowAt(clientX: number, clientY: number): HTMLElement | null {
  const el = document.elementFromPoint(clientX, clientY)
  return el ? (el.closest('.journal-structure__row') as HTMLElement | null) : null
}

function handlePointerDragMove(event: PointerEvent): void {
  const row = findRowAt(event.clientX, event.clientY)
  const targetId = row?.dataset.spreadId
  dragOverSpreadId.value = targetId && targetId !== draggingSpreadId.value ? targetId : null
}

function stopPointerDragTracking(): void {
  window.removeEventListener('pointermove', handlePointerDragMove)
  window.removeEventListener('pointerup', handlePointerDragEnd)
  window.removeEventListener('pointercancel', handlePointerDragCancel)
}

function handlePointerDragEnd(event: PointerEvent): void {
  stopPointerDragTracking()

  const targetId = findRowAt(event.clientX, event.clientY)?.dataset.spreadId
  if (targetId) {
    void onDrop(targetId)
  } else {
    draggingSpreadId.value = null
    dragOverSpreadId.value = null
  }
}

function handlePointerDragCancel(): void {
  stopPointerDragTracking()
  draggingSpreadId.value = null
  dragOverSpreadId.value = null
}

function handleDragHandlePointerDown(event: PointerEvent, spreadId: string): void {
  if (event.pointerType === 'mouse') {
    return
  }

  event.preventDefault()
  onDragStart(spreadId)

  window.addEventListener('pointermove', handlePointerDragMove)
  window.addEventListener('pointerup', handlePointerDragEnd)
  window.addEventListener('pointercancel', handlePointerDragCancel)
}

onBeforeUnmount(() => {
  stopPointerDragTracking()
})

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

.journal-structure__row {
  // Deliberately no border/overflow/radius here — those live on `.journal-structure__card` below
  // instead. `overflow` other than `visible` on a *grid item* zeroes out its "automatic minimum
  // size" contribution to the row's `auto`-track sizing (a real CSS Grid/box-sizing rule, not a
  // rendering bug) — Grid then has no guaranteed floor for this row's height and can lock it to
  // whatever height `<JournalSpreadThumbnail>` happens to report on its very first (pre-measurement)
  // frame, which is 0. Moving the clipping to a plain, non-grid-item child sidesteps that rule
  // entirely: the grid item's own height is now a normal content-based measurement with no special
  // minimum-size carve-out, and the card can still round/clip its corners as before.
  cursor: pointer;

  &:focus-visible .journal-structure__card {
    outline: 2px solid $accent;
    outline-offset: 2px;
  }

  &--dragging {
    opacity: 0.55;
  }

  &--drag-over .journal-structure__card {
    border-color: $text-primary;
    box-shadow: 0 0 0 2px $state-hover-bg;
  }

  &--active .journal-structure__card {
    border-color: $accent;
    box-shadow: 0 0 0 1px $accent;
  }
}

.journal-structure__card {
  border: 1px solid $border-default;
  border-radius: $radius-md;
  overflow: hidden;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;

  .journal-structure__row:hover & {
    border-color: $border-strong;
  }
}

.journal-structure__thumb {
  // No width/height/ratio CSS here on purpose — `<JournalSpreadThumbnail container-ratio="1.19">`
  // measures its own width via JS and sets its height as an explicit pixel value (see that
  // component's `containerRatio` prop doc) — a second layer of defense alongside moving `overflow`
  // off the grid item itself (see `.journal-structure__row`'s comment for the actual root cause).
  // `position: relative` is just to anchor the drag/template-button overlays below.
  position: relative;
  background: $bg-muted;
}

.journal-structure__drag {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  background: rgba(251, 223, 233, 0.92);
  cursor: grab;
  opacity: 1;
  transition: opacity 0.12s ease;
  // Without this, a touch drag starting here is first interpreted as an attempt to scroll the
  // spread list, fighting the pointer-based reorder drag (see handleDragHandlePointerDown).
  touch-action: none;
}

.journal-structure__template-btn {
  position: absolute !important;
  right: 6px;
  bottom: 6px;
  z-index: 1;
  width: 26px !important;
  height: 26px !important;
  border-radius: 7px !important;
  background: rgba(251, 223, 233, 0.92) !important;
  opacity: 1;
  transition: opacity 0.12s ease, background 0.12s ease;

  &:hover {
    background: $accent-tint !important;
  }
}

// The drag handle and template-switch button only surface on hover, so the thumbnail reads clean
// at rest — but that's a mouse-only affordance (there's no real ":hover" on touch), so touch/pen
// devices keep them always visible instead of hiding a control they'd have no way to reveal.
@media (hover: hover) and (pointer: fine) {
  .journal-structure__drag,
  .journal-structure__template-btn {
    opacity: 0;
  }

  .journal-structure__row:hover .journal-structure__drag,
  .journal-structure__row:hover .journal-structure__template-btn,
  .journal-structure__row:focus-within .journal-structure__drag,
  .journal-structure__row:focus-within .journal-structure__template-btn {
    opacity: 1;
  }
}

.journal-structure__meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: $spacing-2 $spacing-2 0;
}

.journal-structure__index {
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

.journal-structure__name {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.journal-structure__status {
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

// Top-right corner of the thumbnail, not tucked into the meta row below — a missing-content
// warning needs to be noticeable at a glance, not something you find only after reading the name
// row. Always visible (unlike the hover-gated drag/template controls): this is information, not
// an action affordance the user only needs on demand. A genuinely red warning, not the theme's
// `error`/`warning` Vuetify colors — those map to muted brown tones (see theme.ts), not the
// unambiguous red this needs against the pink "done" status elsewhere.
.journal-structure__incomplete-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #e5484d;
  box-shadow: 0 1px 4px rgba(#e5484d, 0.5);
}

.journal-structure__type {
  display: block;
  padding: 2px $spacing-2 $spacing-2 31px;
  font-size: 10.5px;
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
