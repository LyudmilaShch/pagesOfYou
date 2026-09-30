<template>
  <v-dialog :model-value="open" max-width="720" @update:model-value="$emit('close')">
    <v-card>
      <v-card-title>Управление разворотами</v-card-title>
      <v-card-subtitle>Перетащите разворот, чтобы изменить порядок</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <div class="spread-reorder__grid">
          <div class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail v-if="coverCanvas" :canvas-data="coverCanvas" :container-ratio="1.19" />
            </div>
            <span class="spread-reorder__label">Обложка</span>
          </div>

          <div v-if="tocCanvas" class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail :canvas-data="tocCanvas" :container-ratio="1.19" />
            </div>
            <span class="spread-reorder__label">Содержание</span>
          </div>

          <div
            v-for="(page, index) in spreadPages"
            :key="page.id"
            class="spread-reorder__item"
            :class="{
              'spread-reorder__item--dragging': draggingId === page.id,
              'spread-reorder__item--drag-over': dragOverId === page.id && draggingId !== page.id,
              'spread-reorder__item--selected': selectedIds.has(page.id),
            }"
            :data-spread-id="page.id"
            draggable="true"
            @dragstart="onDragStart(page.id)"
            @dragover.prevent="dragOverId = page.id"
            @drop="onDrop(page.id)"
            @dragend="onDragEnd"
          >
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail
                v-if="canvasDataByPageId.get(page.id)"
                :canvas-data="canvasDataByPageId.get(page.id)!"
                :container-ratio="1.19"
              />
              <span
                class="spread-reorder__drag"
                aria-hidden="true"
                @pointerdown="handleDragHandlePointerDown($event, page.id)"
              >
                <v-icon size="14" color="primary">mdi-drag-vertical</v-icon>
              </span>
            </div>
            <span class="spread-reorder__label">Разворот {{ index + 1 }}</span>
            <div class="spread-reorder__controls">
              <button
                type="button"
                class="spread-reorder__template-btn"
                draggable="false"
                @click="openTemplatePicker(page)"
              >
                <v-icon size="14">mdi-view-grid-outline</v-icon>
                Шаблон
              </button>
              <button
                type="button"
                class="spread-reorder__select"
                :class="{ 'spread-reorder__select--checked': selectedIds.has(page.id) }"
                draggable="false"
                :aria-pressed="selectedIds.has(page.id)"
                @click="toggleSelected(page.id)"
              >
                <v-icon size="14">{{ selectedIds.has(page.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}</v-icon>
                Удалить
              </button>
            </div>
          </div>

          <div class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail v-if="backCoverCanvas" :canvas-data="backCoverCanvas" :container-ratio="1.19" />
            </div>
            <span class="spread-reorder__label">Задняя обложка</span>
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="spread-reorder__actions">
        <v-btn variant="text" :loading="store.isSaving" @click="handleAddSpread">
          <v-icon size="16" start>mdi-plus</v-icon>
          Добавить 4 страницы
        </v-btn>
        <div class="spread-reorder__remove-group">
          <span v-if="removeHint" class="spread-reorder__remove-hint">{{ removeHint }}</span>
          <v-btn
            variant="text"
            color="error"
            :disabled="!canRemove"
            :loading="store.isSaving"
            @click="handleRemove"
          >
            <v-icon size="16" start>mdi-delete-outline</v-icon>
            Удалить ({{ selectedIds.size }})
          </v-btn>
        </div>
        <v-spacer />
        <v-btn color="primary" @click="$emit('close')">Готово</v-btn>
      </v-card-actions>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-dialog>

  <JournalTemplatePickerDialog
    :open="templatePicker.open"
    :journal-page="templatePicker.page"
    :sequence="templatePicker.sequence"
    :templates="store.groupedTemplates"
    :loading="store.isSaving"
    @close="closeTemplatePicker"
    @apply="handleApplyTemplate"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { MIN_JOURNAL_SPREADS } from '../../constants/journal.constants'
import type { SetJournalPageTemplatePayload } from '../../api/orders.api'
import { useOrderBuilderStore } from '../../stores/order-builder.store'
import type { JournalPage } from '../../types/order.types'
import JournalTemplatePickerDialog from '../JournalTemplatePickerDialog.vue'

const props = defineProps<{
  open: boolean
  pages: JournalPage[]
  canvasDataByPageId: Map<string, CanvasData>
}>()

defineEmits<{ close: [] }>()

const store = useOrderBuilderStore()

const spreadPages = computed(() => props.pages.filter((page) => page.slotType === 'SPREAD'))
const coverCanvas = computed(() => {
  const page = props.pages.find((item) => item.slotType === 'COVER')
  return page ? props.canvasDataByPageId.get(page.id) ?? null : null
})
const backCoverCanvas = computed(() => {
  const page = props.pages.find((item) => item.slotType === 'BACK_COVER')
  return page ? props.canvasDataByPageId.get(page.id) ?? null : null
})
// Same fixed, non-draggable treatment as cover/back-cover — a TOC slot never appears in
// dto.spreadIds server-side either (see orders.service.ts's reorderJournalSpreads), so it can
// only ever sit right after the cover.
const tocCanvas = computed(() => {
  const page = props.pages.find((item) => item.slotType === 'TOC')
  return page ? props.canvasDataByPageId.get(page.id) ?? null : null
})

const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const snackbar = reactive({ show: false, text: '', color: 'success' as 'success' | 'error' })

function notify(text: string, color: 'success' | 'error' = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function onDragStart(spreadId: string): void {
  draggingId.value = spreadId
}

function onDragEnd(): void {
  draggingId.value = null
  dragOverId.value = null
}

async function onDrop(targetSpreadId: string): Promise<void> {
  const sourceId = draggingId.value
  draggingId.value = null
  dragOverId.value = null

  if (!sourceId || sourceId === targetSpreadId) {
    return
  }

  const ids = spreadPages.value.map((page) => page.id)
  const fromIndex = ids.indexOf(sourceId)
  const toIndex = ids.indexOf(targetSpreadId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const next = [...ids]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)

  try {
    await store.reorderJournalSpreads(next)
  } catch {
    notify(store.orderError ?? 'Не удалось изменить порядок', 'error')
  }
}

// Native HTML5 drag-and-drop (draggable/@dragstart/@dragover/@drop above) only fires from a
// mouse — most mobile browsers never start a native drag from a touch gesture at all. This is a
// parallel, Pointer Events-based path for touch/pen input on the same handle — mirrors
// JournalStructurePanel.vue's own reorder handle.
function findSpreadAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const row = el ? (el.closest('.spread-reorder__item') as HTMLElement | null) : null
  return row?.dataset.spreadId ?? null
}

function handlePointerDragMove(event: PointerEvent): void {
  const targetId = findSpreadAt(event.clientX, event.clientY)
  dragOverId.value = targetId && targetId !== draggingId.value ? targetId : null
}

function stopPointerDragTracking(): void {
  window.removeEventListener('pointermove', handlePointerDragMove)
  window.removeEventListener('pointerup', handlePointerDragEnd)
  window.removeEventListener('pointercancel', handlePointerDragCancel)
}

function handlePointerDragEnd(event: PointerEvent): void {
  stopPointerDragTracking()

  const targetId = findSpreadAt(event.clientX, event.clientY)
  if (targetId) {
    void onDrop(targetId)
  } else {
    onDragEnd()
  }
}

function handlePointerDragCancel(): void {
  stopPointerDragTracking()
  onDragEnd()
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

// ---------------------------------------------------------------------------
// Delete — spreads only ever leave in pairs (4 pages, 1 print signature), same reasoning as
// `store.addJournalSpread` always adding exactly 2 at once (see its own doc comment). The store
// action itself doesn't re-check this (SpreadManagerDialog.vue — this component — is currently its
// only caller, so the UI-level `canRemove` gate below is what actually enforces it); the backend
// re-validates independently regardless (`OrdersService.removeJournalSpreads`).
// ---------------------------------------------------------------------------

const selectedIds = ref<Set<string>>(new Set())

function toggleSelected(spreadId: string): void {
  const next = new Set(selectedIds.value)
  if (next.has(spreadId)) {
    next.delete(spreadId)
  } else {
    next.add(spreadId)
  }
  selectedIds.value = next
}

const canRemove = computed(() => {
  const count = selectedIds.value.size
  return count > 0 && count % 2 === 0 && spreadPages.value.length - count >= MIN_JOURNAL_SPREADS
})

const removeHint = computed(() => {
  const count = selectedIds.value.size
  if (count === 0) {
    return null
  }
  if (count % 2 !== 0) {
    return 'Выберите чётное количество разворотов (по 2)'
  }
  if (spreadPages.value.length - count < MIN_JOURNAL_SPREADS) {
    return `В журнале должно остаться минимум ${MIN_JOURNAL_SPREADS} разворотов`
  }
  return null
})

async function handleRemove(): Promise<void> {
  if (!canRemove.value) {
    return
  }

  const ids = [...selectedIds.value]
  try {
    await store.removeJournalSpread(ids)
    selectedIds.value = new Set()
    notify('Развороты удалены')
  } catch {
    notify(store.orderError ?? 'Не удалось удалить развороты', 'error')
  }
}

// ---------------------------------------------------------------------------
// Template picker + add-spread — own independent instance of JournalTemplatePickerDialog, same
// reasoning as JournalStructurePanel.vue's own separate one (see that component): each place that
// offers template picking manages its own local dialog state rather than sharing one across
// components. QuestionnaireBook.vue keeps its own, narrower copy (its frame's own "Сменить
// шаблон" button, for the currently-VIEWED page only, no add-spread queue) — this one additionally
// drives the "just added N spreads" queue below, since add-spread lives here now, not there.
// ---------------------------------------------------------------------------

const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
  sequence: { current: number; total: number } | null
}>({ open: false, page: null, sequence: null })

const templateQueue = ref<JournalPage[]>([])
const templateQueueTotal = ref(0)

function openTemplatePicker(page: JournalPage): void {
  templateQueue.value = []
  templateQueueTotal.value = 0
  templatePicker.page = page
  templatePicker.sequence = null
  templatePicker.open = true
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
  templatePicker.sequence = null
  templateQueue.value = []
  templateQueueTotal.value = 0
}

/** Pops the next spread off `templateQueue` and reopens the dialog on it, or closes the dialog
 * once the queue (and any single ad-hoc pick) is exhausted. */
function advanceTemplateQueue(): void {
  const next = templateQueue.value.shift()
  if (!next) {
    closeTemplatePicker()
    return
  }

  const current = templateQueueTotal.value - templateQueue.value.length
  templatePicker.page = next
  templatePicker.sequence = { current, total: templateQueueTotal.value }
  templatePicker.open = true
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    notify('Шаблон применён')
    advanceTemplateQueue()
  } catch {
    notify(store.orderError ?? 'Не удалось применить шаблон', 'error')
  }
}

async function handleAddSpread(): Promise<void> {
  // Adds 2 spreads (4 pages) at once, both starting on the same auto-picked default template —
  // see order-builder.store.ts's addJournalSpread doc comment. Diffing spread ids before/after
  // queues both new spreads through the template picker right away, one after another, instead of
  // leaving the default silently applied to either.
  const previousSpreadIds = new Set(
    (store.order?.journalPages ?? []).filter((page) => page.slotType === 'SPREAD').map((page) => page.id),
  )

  try {
    await store.addJournalSpread()
    notify('4 страницы добавлены')

    const newSpreads = (store.order?.journalPages ?? []).filter(
      (page) => page.slotType === 'SPREAD' && !previousSpreadIds.has(page.id),
    )
    if (newSpreads.length > 0) {
      templateQueue.value = newSpreads
      templateQueueTotal.value = newSpreads.length
      advanceTemplateQueue()
    }
  } catch {
    notify(store.orderError ?? 'Не удалось добавить страницы', 'error')
  }
}
</script>

<style scoped lang="scss">
.spread-reorder__grid {
  display: grid;
  // Wide enough that the two labeled buttons under each spread (.spread-reorder__controls) sit
  // side by side without wrapping — 120px (the old, icon-overlay-only width) was too narrow once
  // those got real text labels.
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: $spacing-3;
}

.spread-reorder__item {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  cursor: grab;

  &--dragging {
    opacity: 0.55;
  }

  &--drag-over .spread-reorder__thumb {
    border-color: $accent;
    box-shadow: 0 0 0 2px $state-hover-bg;
  }

  &--fixed {
    cursor: default;
    opacity: 0.7;
  }

  &--selected .spread-reorder__thumb {
    border-color: #e5484d;
    box-shadow: 0 0 0 2px rgba(229, 72, 77, 0.25);
  }
}

.spread-reorder__thumb {
  position: relative;
  border: 1px solid $border-default;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.spread-reorder__drag {
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
  // Without this, a touch drag starting here is first interpreted as an attempt to scroll the
  // dialog, fighting the pointer-based reorder drag (see handleDragHandlePointerDown).
  touch-action: none;
}

.spread-reorder__label {
  font-size: $font-size-caption;
  color: $text-secondary;
  text-align: center;
}

// Labeled text+icon buttons under each spread, in place of the bare icon overlays this replaced —
// those were unreadable at a glance because nothing on them distinguished "select for deletion"
// from "change template" beyond the icon shape alone.
.spread-reorder__controls {
  display: flex;
  gap: $spacing-1;
  // `draggable="false"` (template) is what stops a click here from ALSO being read as the start
  // of a native tile drag — only the mouse path relies on the whole tile being draggable, so
  // that's the one this guards; this cursor override just keeps the hint consistent with it.
  cursor: default;
}

.spread-reorder__template-btn,
.spread-reorder__select {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 6px;
  border: 1px solid $border-default;
  border-radius: $radius-sm;
  background: $white;
  color: $text-secondary;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}

.spread-reorder__template-btn:hover {
  border-color: $accent;
  color: $accent-deep;
}

.spread-reorder__select:hover {
  border-color: #e5484d;
  color: #e5484d;
}

.spread-reorder__select--checked {
  border-color: #e5484d;
  background: #e5484d;
  color: #fff;
}

.spread-reorder__actions {
  flex-wrap: wrap;
  row-gap: $spacing-2;
}

.spread-reorder__remove-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.spread-reorder__remove-hint {
  font-size: $font-size-caption;
  color: $text-secondary;
}
</style>
