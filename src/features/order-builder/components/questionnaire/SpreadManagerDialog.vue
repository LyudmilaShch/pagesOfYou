<template>
  <v-dialog :model-value="open" max-width="960" scrollable @update:model-value="$emit('close')">
    <v-card class="spread-reorder__card">
      <v-card-title>Управление разворотами</v-card-title>
      <v-card-subtitle>Перетащите разворот, чтобы изменить порядок</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <v-alert v-if="!isSpreadCountValid" type="warning" variant="tonal" density="compact" class="mb-4 spread-reorder__banner">
          Чтобы книгу можно было напечатать, количество разворотов должно быть нечётным — иначе
          общее число страниц не кратно 4 (печать идёт тетрадями по 4 страницы). Добавьте или
          удалите ещё один разворот.
        </v-alert>

        <!-- `css` stays off for the whole touch drag. Otherwise every finger-move re-render makes
             TransitionGroup FLIP the card back toward its grid cell, so the spread being dragged
             jumps. The glide comes back on drop, once `draggingId` is cleared and the list reorders. -->
        <TransitionGroup
          tag="div"
          name="spread"
          :css="!draggingId"
          class="spread-reorder__grid"
          @dragover.prevent="onNativeDragOver"
          @drop.prevent="onNativeDrop"
        >
          <div key="cover" class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail v-if="coverCanvas" :canvas-data="coverCanvas" :container-ratio="1.19" />
            </div>
            <div class="spread-reorder__body">
              <span class="spread-reorder__label">Обложка</span>
            </div>
          </div>

          <div v-if="tocCanvas" key="toc" class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail :canvas-data="tocCanvas" :container-ratio="1.19" />
            </div>
            <div class="spread-reorder__body">
              <span class="spread-reorder__label">Содержание</span>
            </div>
          </div>

          <div
            v-for="page in displayedSpreadPages"
            :key="page.id"
            class="spread-reorder__item"
            :class="{ 'spread-reorder__item--dragging': draggingId === page.id }"
            :data-spread-id="page.id"
            :draggable="nativeDrag"
            @dragstart="onNativeDragStart($event, page.id)"
            @dragend="onDragEnd"
            @pointerdown="handleItemPointerDown($event, page.id)"
          >
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail
                v-if="canvasDataByPageId.get(page.id)"
                :canvas-data="canvasDataByPageId.get(page.id)!"
                :container-ratio="1.19"
              />
              <span class="spread-reorder__drag" aria-hidden="true">
                <v-icon size="14" color="primary">mdi-drag-vertical</v-icon>
              </span>
            </div>
            <div class="spread-reorder__body">
              <span class="spread-reorder__label">{{ templateLabel(page) }}</span>
              <div class="spread-reorder__controls">
                <button
                  type="button"
                  class="spread-reorder__template-btn"
                  draggable="false"
                  @click="openTemplatePicker(page)"
                >
                  <v-icon size="12">mdi-view-grid-outline</v-icon>
                  Шаблон
                </button>
                <button
                  type="button"
                  class="spread-reorder__delete-btn"
                  draggable="false"
                  aria-label="Удалить разворот"
                  @click="confirmDelete(page.id)"
                >
                  <v-icon size="12">mdi-trash-can-outline</v-icon>
                </button>
              </div>
            </div>
          </div>

          <button
            key="add-spread"
            type="button"
            class="spread-reorder__add"
            :disabled="store.isSaving"
            @click="handleAddSpread"
          >
            <span class="spread-reorder__add-icon" aria-hidden="true">
              <v-icon size="20">mdi-plus</v-icon>
            </span>
            <span class="spread-reorder__add-label">Добавить разворот</span>
          </button>

          <div key="back-cover" class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail v-if="backCoverCanvas" :canvas-data="backCoverCanvas" :container-ratio="1.19" />
            </div>
            <div class="spread-reorder__body">
              <span class="spread-reorder__label">Задняя обложка</span>
            </div>
          </div>
        </TransitionGroup>
      </v-card-text>

      <v-divider />
      <v-card-actions class="spread-reorder__actions">
        <v-btn
          v-if="trashItems.length > 0"
          variant="outlined"
          class="spread-reorder__trash-btn"
          @click="trashDialogOpen = true"
        >
          <v-icon size="16" start>mdi-trash-can-outline</v-icon>
          Корзина
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="handleDone">Готово</v-btn>
      </v-card-actions>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-dialog>

  <v-dialog v-model="trashDialogOpen" max-width="720" scrollable>
    <v-card>
      <v-card-title>Корзина</v-card-title>
      <v-card-subtitle>Удалённые развороты — фото и ответы сохранены, их можно восстановить</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <p v-if="trashItems.length === 0" class="spread-reorder__trash-empty">Корзина пуста</p>
        <div v-else class="spread-reorder__grid">
          <div v-for="item in trashItems" :key="item.id" class="spread-reorder__item spread-reorder__item--fixed">
            <div class="spread-reorder__thumb">
              <JournalSpreadThumbnail
                v-if="trashCanvasByPageId.get(item.id)"
                :canvas-data="trashCanvasByPageId.get(item.id)!"
                :container-ratio="1.19"
              />
            </div>
            <div class="spread-reorder__body">
              <v-btn size="small" variant="text" :loading="store.isSaving" @click="handleRestore(item.id)">
                <v-icon size="14" start>mdi-restore</v-icon>
                Восстановить
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="trashDialogOpen = false">Закрыть</v-btn>
      </v-card-actions>
    </v-card>
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

  <ConfirmModal
    v-model="deleteDialogOpen"
    title="Удалить разворот?"
    confirm-label="Удалить"
    confirm-color="error"
    :loading="store.isSaving"
    @confirm="handleConfirmDelete"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { SetJournalPageTemplatePayload } from '../../api/orders.api'
import { useOrderBuilderStore } from '../../stores/order-builder.store'
import type { JournalPage, TrashedJournalPage } from '../../types/order.types'
import { countSpreadSlots } from '../../utils/journal-structure.util'
import { presentCustomerPageCanvas } from '../../utils/missing-photos.util'
import JournalTemplatePickerDialog from '../JournalTemplatePickerDialog.vue'

const props = defineProps<{
  open: boolean
  pages: JournalPage[]
  canvasDataByPageId: Map<string, CanvasData>
}>()

const emit = defineEmits<{ close: [] }>()

const store = useOrderBuilderStore()

const spreadPages = computed(() => props.pages.filter((page) => page.slotType === 'SPREAD'))

// The admin-given template name, not an ordinal position — a spread's number already shifts as
// others are added/removed/reordered, so it was never a stable label anyway. Same convention as
// JournalStructurePanel.vue's own templateLabel for a SPLIT_PAGES spread (two templates at once).
function templateLabel(page: JournalPage): string {
  return page.layoutMode === 'SPLIT_PAGES'
    ? `${page.magazinePage.name} + ${page.rightMagazinePage?.name ?? '—'}`
    : page.magazinePage.name
}
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

// Printing requires the final page count to be a multiple of 4 — equivalent to
// `countSpreadSlots` (SPREAD+TOC, same metric the backend and pricing use) staying odd, the same
// invariant `MIN_JOURNAL_SPREADS`'s own doc comment explains. Add/remove is free and one-at-a-time
// now, so this can go temporarily even — that's fine until the user tries to leave the manager.
const isSpreadCountValid = computed(() => countSpreadSlots(props.pages) % 2 === 1)

const draggingId = ref<string | null>(null)
// Live preview of the reordered list, swapped in place as the dragged card passes over another
// one (not just when it's finally dropped) — null outside of an active drag, when `spreadPages`
// itself is what renders outside a drag. Swapping only happens once, on drop — an earlier version
// re-swapped live on every dragover tick (many times a second, re-triggering the FLIP transition
// before it finished), which was the actual cause of the "дёргание" this replaced; reordering once
// and letting TransitionGroup's .spread-move animate that single change is plenty "modern" on its
// own, without the live-preview churn.
const dragPreview = ref<JournalPage[] | null>(null)
const displayedSpreadPages = computed(() => dragPreview.value ?? spreadPages.value)

const snackbar = reactive({ show: false, text: '', color: 'success' as 'success' | 'error' })

function notify(text: string, color: 'success' | 'error' = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function onDragStart(spreadId: string): void {
  draggingId.value = spreadId
}

function onNativeDragStart(event: DragEvent, spreadId: string): void {
  if (!nativeDrag) {
    event.preventDefault()
    return
  }
  onDragStart(spreadId)
}

function onDragEnd(): void {
  draggingId.value = null
}

// Browsers hold off repainting while a native drag gesture is still wrapping up (`drop` fires
// just before it), so a reorder triggered directly from the `drop`/`pointerup` handler can patch
// the DOM without the move ever visibly animating. Two animation frames is what gets past that.
function commitInsert(sourceId: string, beforeId: string | null): void {
  draggingId.value = null
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void applyInsertBefore(sourceId, beforeId)
    })
  })
}

let nativePointer: { x: number; y: number } | null = null

function onNativeDragOver(event: DragEvent): void {
  if (event.clientX === 0 && event.clientY === 0) {
    return
  }
  nativePointer = { x: event.clientX, y: event.clientY }
}

function onNativeDrop(event: DragEvent): void {
  const sourceId = draggingId.value
  const point = event.clientX === 0 && event.clientY === 0 ? nativePointer : { x: event.clientX, y: event.clientY }
  nativePointer = null
  if (!sourceId || !point) {
    draggingId.value = null
    return
  }
  commitInsert(sourceId, spreadIdBeforePoint(sourceId, point.x, point.y))
}

// `beforeId` is the spread the dragged card should sit in front of — null means the end of the
// list. Index is taken after the source is removed, so a downward move doesn't land one past
// the gap the card was dropped into.
async function applyInsertBefore(sourceId: string, beforeId: string | null): Promise<void> {
  const ids = spreadPages.value.map((page) => page.id)
  const fromIndex = ids.indexOf(sourceId)
  if (fromIndex === -1) {
    return
  }

  const next = [...ids]
  next.splice(fromIndex, 1)
  if (beforeId == null) {
    next.push(sourceId)
  } else {
    const toIndex = next.indexOf(beforeId)
    if (toIndex === -1) {
      return
    }
    next.splice(toIndex, 0, sourceId)
  }

  if (next.every((id, index) => id === ids[index])) {
    return
  }
  await applyReorderIds(next)
}

async function applyReorderIds(next: string[]): Promise<void> {
  // Preview the already-decided final order immediately (TransitionGroup animates straight to it)
  // instead of waiting for the store round-trip, the same reasoning `applyLocalAddSpread` etc.
  // already lean on elsewhere — only cleared once the save settles, success or not, so there's no
  // snap-back-then-forward flicker while it's in flight.
  dragPreview.value = next.map((id) => spreadPages.value.find((page) => page.id === id)!)

  try {
    await store.reorderJournalSpreads(next)
  } catch {
    notify(store.orderError ?? 'Не удалось изменить порядок', 'error')
  } finally {
    dragPreview.value = null
  }
}

// The spread that should end up just after the drop. `anchor` is the dragged card's center on
// touch and the cursor on desktop. A gap between cards is empty, so the card under the pointer
// is the wrong answer — the boundary is each neighbour's center.
function spreadIdBeforePoint(sourceId: string, anchorX: number, anchorY: number): string | null {
  const cards = [...document.querySelectorAll<HTMLElement>('.spread-reorder__item[data-spread-id]')]
    .filter((card) => card.dataset.spreadId && card.dataset.spreadId !== sourceId)
    .map((card) => ({ id: card.dataset.spreadId as string, rect: card.getBoundingClientRect() }))

  const sharesRow = (rect: DOMRect): boolean => {
    const midY = rect.top + rect.height / 2
    return cards.some((other) => {
      if (other.rect === rect) {
        return false
      }
      const otherMidY = other.rect.top + other.rect.height / 2
      return Math.abs(otherMidY - midY) < rect.height / 2
    })
  }

  for (const card of cards) {
    const midY = card.rect.top + card.rect.height / 2
    const midX = card.rect.left + card.rect.width / 2
    if (sharesRow(card.rect)) {
      // Pointer above this row slots in front of it. On the row itself, the gap is horizontal.
      if (anchorY < midY - card.rect.height / 2) {
        return card.id
      }
      if (Math.abs(anchorY - midY) < card.rect.height / 2 && anchorX < midX) {
        return card.id
      }
      continue
    }
    if (anchorY < midY) {
      return card.id
    }
  }
  return null
}

// A phone's primary pointer is touch, and HTML5 drag never starts from it. Desktop (a real mouse)
// keeps the native path above.
const nativeDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches

// How long a finger must rest on a card before it becomes a drag. A move before that is a scroll
// of the dialog — the cards fill the list, so the same surface has to do both.
const DRAG_HOLD_MS = 180
const DRAG_CANCEL_DISTANCE = 12

// Finger inside this band at the top or bottom of the list scrolls it, so a spread can be
// carried onto a card that started off-screen.
const SCROLL_EDGE_PX = 80
const SCROLL_MAX_STEP_PX = 16

let activePointerId: number | null = null
let pointerOrigin = { x: 0, y: 0 }
let lastPointer = { x: 0, y: 0 }
let holdTimer: ReturnType<typeof setTimeout> | null = null
let pointerDragArmed = false
let captureEl: HTMLElement | null = null
let scrollEl: HTMLElement | null = null
let scrollOriginTop = 0
let scrollFrame = 0

// Written straight onto the element. A Vue style binding would re-render the TransitionGroup on
// every pointermove, and that group's move animation then pulls the card back to its cell.
function setDragTransform(dx: number, dy: number): void {
  if (!captureEl) {
    return
  }
  // Inline, not a class: the class arrives a frame later, and until then the card's own
  // transform transition eases the first move and the card jumps ahead of the finger.
  captureEl.style.transition = 'none'
  captureEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`
}

function clearHoldTimer(): void {
  if (holdTimer != null) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
}

function preventTouchScroll(event: TouchEvent): void {
  if (pointerDragArmed) {
    event.preventDefault()
  }
}

// The card's own cell scrolls away with the list, so the translate has to add that distance
// back — otherwise the spread slides off the finger as soon as the list moves.
function applyDragTransform(): void {
  const scrolled = (scrollEl?.scrollTop ?? scrollOriginTop) - scrollOriginTop
  setDragTransform(lastPointer.x - pointerOrigin.x, lastPointer.y - pointerOrigin.y + scrolled)
}

function autoScrollStep(): void {
  scrollFrame = 0
  if (!pointerDragArmed || !scrollEl) {
    return
  }

  const rect = scrollEl.getBoundingClientRect()
  const y = lastPointer.y
  let delta = 0
  if (y > rect.bottom - SCROLL_EDGE_PX) {
    const depth = Math.min(1, (y - (rect.bottom - SCROLL_EDGE_PX)) / SCROLL_EDGE_PX)
    delta = Math.ceil(depth * SCROLL_MAX_STEP_PX)
  } else if (y < rect.top + SCROLL_EDGE_PX) {
    const depth = Math.min(1, (rect.top + SCROLL_EDGE_PX - y) / SCROLL_EDGE_PX)
    delta = -Math.ceil(depth * SCROLL_MAX_STEP_PX)
  }

  if (delta !== 0) {
    const max = scrollEl.scrollHeight - scrollEl.clientHeight
    const next = Math.min(max, Math.max(0, scrollEl.scrollTop + delta))
    if (next !== scrollEl.scrollTop) {
      scrollEl.scrollTop = next
      applyDragTransform()
    }
  }

  if (pointerDragArmed) {
    scrollFrame = requestAnimationFrame(autoScrollStep)
  }
}

function stopPointerDragTracking(): void {
  clearHoldTimer()
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  window.removeEventListener('pointermove', handlePointerDragMove)
  window.removeEventListener('pointerup', handlePointerDragEnd)
  window.removeEventListener('pointercancel', handlePointerDragCancel)
  window.removeEventListener('touchmove', preventTouchScroll)
  if (captureEl) {
    captureEl.style.transition = ''
    captureEl.style.transform = ''
  }
  activePointerId = null
  captureEl = null
  scrollEl = null
  pointerDragArmed = false
}

function armPointerDrag(spreadId: string): void {
  if (pointerDragArmed || activePointerId == null) {
    return
  }
  pointerDragArmed = true
  scrollEl = captureEl?.closest('.v-card-text') as HTMLElement | null
  scrollOriginTop = scrollEl?.scrollTop ?? 0
  lastPointer = { ...pointerOrigin }
  try {
    captureEl?.setPointerCapture(activePointerId)
  } catch {
    // The pointer can already be gone if the finger lifted in the same turn.
  }
  onDragStart(spreadId)
  scrollFrame = requestAnimationFrame(autoScrollStep)
}

function handlePointerDragMove(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) {
    return
  }

  const dx = event.clientX - pointerOrigin.x
  const dy = event.clientY - pointerOrigin.y

  if (!pointerDragArmed) {
    if (dx * dx + dy * dy > DRAG_CANCEL_DISTANCE * DRAG_CANCEL_DISTANCE) {
      stopPointerDragTracking()
    }
    return
  }

  event.preventDefault()
  lastPointer = { x: event.clientX, y: event.clientY }
  applyDragTransform()
  if (!scrollFrame) {
    scrollFrame = requestAnimationFrame(autoScrollStep)
  }
}

function handlePointerDragEnd(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) {
    return
  }

  const armed = pointerDragArmed
  const sourceId = armed ? captureEl?.dataset.spreadId ?? null : null
  let beforeId: string | null = null
  if (armed && captureEl && sourceId) {
    const anchor = captureEl.getBoundingClientRect()
    beforeId = spreadIdBeforePoint(sourceId, anchor.left + anchor.width / 2, anchor.top + anchor.height / 2)
  }
  stopPointerDragTracking()

  if (armed && sourceId) {
    commitInsert(sourceId, beforeId)
  }
}

function handlePointerDragCancel(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) {
    return
  }
  stopPointerDragTracking()
  onDragEnd()
}

function handleItemPointerDown(event: PointerEvent, spreadId: string): void {
  if (event.pointerType === 'mouse') {
    return
  }
  if ((event.target as HTMLElement | null)?.closest('button')) {
    return
  }

  activePointerId = event.pointerId
  captureEl = event.currentTarget as HTMLElement
  pointerOrigin = { x: event.clientX, y: event.clientY }
  pointerDragArmed = false

  const fromHandle = Boolean((event.target as HTMLElement | null)?.closest('.spread-reorder__drag'))
  if (fromHandle) {
    event.preventDefault()
    armPointerDrag(spreadId)
  } else {
    holdTimer = setTimeout(() => armPointerDrag(spreadId), DRAG_HOLD_MS)
  }

  window.addEventListener('pointermove', handlePointerDragMove)
  window.addEventListener('pointerup', handlePointerDragEnd)
  window.addEventListener('pointercancel', handlePointerDragCancel)
  window.addEventListener('touchmove', preventTouchScroll, { passive: false })
}

onBeforeUnmount(() => {
  stopPointerDragTracking()
})

// ---------------------------------------------------------------------------
// Delete + recycle bin — free, one spread at a time, moved into the trash (restorable) rather
// than discarded. Confirmed via ConfirmModal before each delete.
// ---------------------------------------------------------------------------

const deleteDialogOpen = ref(false)
const pendingDeleteId = ref<string | null>(null)

function confirmDelete(spreadId: string): void {
  pendingDeleteId.value = spreadId
  deleteDialogOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  const id = pendingDeleteId.value
  if (!id) {
    return
  }

  try {
    await store.removeJournalSpread([id])
    deleteDialogOpen.value = false
    pendingDeleteId.value = null
    notify('Разворот перемещён в корзину')
    await loadTrash()
  } catch {
    notify(store.orderError ?? 'Не удалось удалить разворот', 'error')
  }
}

const trashDialogOpen = ref(false)
const trashItems = ref<TrashedJournalPage[]>([])
const trashCanvasByPageId = computed(() => {
  const map = new Map<string, CanvasData>()
  for (const item of trashItems.value) {
    map.set(item.id, presentCustomerPageCanvas(item))
  }
  return map
})

async function loadTrash(): Promise<void> {
  trashItems.value = await store.fetchTrashedJournalSpreads()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadTrash()
    }
  },
)

async function handleRestore(spreadId: string): Promise<void> {
  try {
    await store.restoreJournalSpread(spreadId)
    notify('Разворот восстановлен')
    await loadTrash()
  } catch {
    notify(store.orderError ?? 'Не удалось восстановить разворот', 'error')
  }
}

function handleDone(): void {
  if (!isSpreadCountValid.value) {
    notify('Добавьте или удалите ещё один разворот, прежде чем закрыть менеджер', 'error')
    return
  }
  emit('close')
}

// ---------------------------------------------------------------------------
// Template picker + add-spread — own independent instance of JournalTemplatePickerDialog, same
// reasoning as JournalStructurePanel.vue's own separate one (see that component): each place that
// offers template picking manages its own local dialog state rather than sharing one across
// components. QuestionnaireBook.vue keeps its own, narrower copy (its frame's own "Сменить
// шаблон" button, for the currently-VIEWED page only) — this one additionally drives the
// "just added a spread" hand-off below, since add-spread lives here now, not there.
// ---------------------------------------------------------------------------

const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
  sequence: { current: number; total: number } | null
}>({ open: false, page: null, sequence: null })

function openTemplatePicker(page: JournalPage): void {
  templatePicker.page = page
  templatePicker.sequence = null
  templatePicker.open = true
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
  templatePicker.sequence = null
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    notify('Шаблон применён')
    closeTemplatePicker()
  } catch {
    notify(store.orderError ?? 'Не удалось применить шаблон', 'error')
  }
}

async function handleAddSpread(): Promise<void> {
  // Adds 1 spread on a auto-picked default template — see order-builder.store.ts's
  // addJournalSpread doc comment. Diffing spread ids before/after finds it and opens the template
  // picker on it right away, instead of leaving the default silently applied.
  const previousSpreadIds = new Set(
    (store.order?.journalPages ?? []).filter((page) => page.slotType === 'SPREAD').map((page) => page.id),
  )

  try {
    await store.addJournalSpread()
    notify('Разворот добавлен')

    const newSpread = (store.order?.journalPages ?? []).find(
      (page) => page.slotType === 'SPREAD' && !previousSpreadIds.has(page.id),
    )
    if (newSpread) {
      openTemplatePicker(newSpread)
    }
  } catch {
    notify(store.orderError ?? 'Не удалось добавить разворот', 'error')
  }
}
</script>

<style scoped lang="scss">
.spread-reorder__grid {
  // Containing block for .spread-leave-active's position: absolute (below) — without it, a
  // leaving card would jump to whatever ancestor happens to be positioned instead of fading out
  // roughly where it was.
  position: relative;
  display: grid;
  // Bigger than before (148px) so the thumbnail — same width as the card, JournalSpreadThumbnail
  // keeps its own aspect ratio — reads clearly at a glance instead of as a tiny chip.
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: $spacing-3;
  min-width: 0;
  max-width: 100%;
}

.spread-reorder__item {
  display: flex;
  flex-direction: column;
  // No padding/gap here — .spread-reorder__thumb spans the card edge-to-edge (its own gray fills
  // the whole upper portion, not just an inset rectangle) and .spread-reorder__body below carries
  // the padding instead. overflow: hidden is what clips the thumb's square bottom corners to the
  // card's own rounding.
  overflow: hidden;
  // Vertical pans still scroll the dialog. A touch drag (see handleItemPointerDown) takes over
  // only after a short hold, or immediately from the grip, and then blocks that scroll itself.
  touch-action: pan-y;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-xl;
  cursor: grab;
  transition: transform 0.18s $ease-out-editorial, box-shadow 0.18s $ease-out-editorial, opacity 0.18s $ease-out-editorial;

  // The dragged card itself lifts off the grid — scale, shadow, a slight tilt — instead of a
  // colored ring on the drop target. No drop-target highlight at all now: the grid's own FLIP
  // reflow (.spread-move, below) is what shows where it'll land, by sliding the other cards.
  &--dragging {
    box-shadow: $shadow-lg;
    opacity: 0.9;
    cursor: grabbing;
    // Beats `.spread-move`, which would otherwise ease this card back toward its grid cell on
    // every finger move. pointer-events stays off so the drop hits the card underneath.
    transition: none !important;
    pointer-events: none;
    z-index: 5;
  }

  &--fixed {
    cursor: default;
    opacity: 0.7;
  }
}

// Sits in the grid right before the back cover (template) — same footprint as a real spread card
// (thumb + body combined), but dashed/ghost-styled to read as "add a new one here" rather than
// content. height: 100% (not a guessed aspect-ratio) is what actually matches it: CSS grid's
// default stretch alignment already sizes every row to its tallest card, this just opts in to
// filling that instead of sizing off its own (much shorter) icon+label content.
.spread-reorder__add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  height: 100%;
  padding: $spacing-3;
  background: $bg-elevated;
  border: 1px dashed $border-strong;
  border-radius: $radius-xl;
  color: $text-secondary;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;

  &:hover:not(:disabled) {
    background: $bg-tertiary;
    border-color: $accent;
    color: $accent-deep;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.spread-reorder__add-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid $border-strong;
  border-radius: 9999px;
  color: inherit;
}

.spread-reorder__add-label {
  font-size: $font-size-caption;
  color: inherit;
}

// Vue's TransitionGroup (name="spread") applies this to every card that's shifting to a new grid
// cell — reordering, adding or removing a spread moves the rest, and this is what makes them glide
// into place instead of snapping.
.spread-move {
  transition: transform 0.3s $ease-out-editorial;
}

.spread-enter-active {
  transition: opacity 0.25s $ease-out-editorial, transform 0.25s $ease-out-editorial;
}

.spread-leave-active {
  transition: opacity 0.2s $ease-out-editorial, transform 0.2s $ease-out-editorial;
  // Pulled out of grid flow while leaving, so its neighbors' .spread-move glide into the freed
  // slot immediately instead of waiting for this card to finish fading out.
  position: absolute;
}

.spread-enter-from,
.spread-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.spread-reorder__thumb {
  position: relative;
  background: $bg-muted;
  transition: box-shadow 0.12s ease;
}

.spread-reorder__body {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  padding: $spacing-2;
}

.spread-reorder__drag {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  background: rgba(251, 223, 233, 0.92);
  cursor: grab;
  // A touch that starts here is a drag immediately (see handleItemPointerDown), so the dialog
  // must not treat it as a scroll.
  touch-action: none;

  @include mobile-only {
    width: 36px;
    height: 36px;
  }
}

.spread-reorder__label {
  display: block;
  overflow: hidden;
  font-size: $font-size-caption;
  font-weight: $font-weight-regular;
  color: $text-primary;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;

  // A phone card is one column and still narrower than a long template name, so the name wraps
  // instead of ending in an ellipsis.
  @include mobile-only {
    white-space: normal;
    overflow-wrap: anywhere;
    overflow: hidden;
    text-overflow: unset;
  }
}

// Labeled text+icon buttons under each spread, in place of the bare icon overlays this originally
// replaced — those were unreadable at a glance because nothing on them distinguished "mark for
// deletion" from "change template" beyond the icon shape alone.
.spread-reorder__controls {
  display: flex;
  gap: $spacing-1;
  // `draggable="false"` (template) is what stops a click here from ALSO being read as the start
  // of a native tile drag — only the mouse path relies on the whole tile being draggable, so
  // that's the one this guards; this cursor override just keeps the hint consistent with it.
  cursor: default;
}

.spread-reorder__template-btn,
.spread-reorder__delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid $border-default;
  border-radius: $radius-sm;
  background: $white;
  color: $text-secondary;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}

.spread-reorder__template-btn {
  flex: 1;
  padding: 3px 5px;
}

.spread-reorder__delete-btn {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
}

.spread-reorder__template-btn:hover {
  border-color: $accent;
  color: $accent-deep;
}

.spread-reorder__delete-btn:hover {
  border-color: #e5484d;
  color: #e5484d;
}

.spread-reorder__trash-btn {
  border-radius: 9999px;
  text-transform: none;
  padding-left: $spacing-4;
  padding-right: $spacing-4;
}

.spread-reorder__trash-empty {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
}

// `density="compact"` (template) only trims the v-alert's own padding/min-height — the message
// text itself stays at the default body size unless overridden here too.
.spread-reorder__banner :deep(.v-alert__content) {
  font-size: $font-size-caption;
}

// Pulls the subtitle right under the title in both of this component's dialogs — Vuetify's own
// default (0.5rem title bottom padding + a zero-padding subtitle) still reads as too loose — then
// opens up more room below the subtitle before the divider, so the two don't feel cramped together.
:deep(.v-card-title) {
  padding-bottom: 0;
}

:deep(.v-card-subtitle) {
  margin-top: -2px;
  margin-bottom: $spacing-3;
  // Vuetify keeps a card subtitle on one line and ellipsizes the rest. On a phone that cuts off
  // "Перетащите разворот…" and the trash dialog's longer note before they finish.
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  line-height: 1.4;
}

// Caps the dialog so `scrollable` (v-dialog) has an actual boundary to work within — without a
// height limit the card just grows with content and the footer scrolls off with everything else.
// `max-height` rather than a fixed `height` so a short list (few spreads, empty trash) doesn't
// leave a tall card mostly empty.
.spread-reorder__card {
  max-height: 85vh;
  overflow-x: hidden;

  // The list scrolls vertically. A dragged card (scaled, shifted toward the finger) and a long
  // template name must not open a second, horizontal scrollbar.
  :deep(.v-card-text) {
    overflow-x: hidden;
  }
}

.spread-reorder__actions {
  flex-wrap: wrap;
  row-gap: $spacing-2;
}
</style>
