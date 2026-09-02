<template>
  <div v-if="store.multiSelectMode || store.isMultiSelection" ref="barRootRef" class="ms-bar" :style="dockDragStyle">

    <div
      class="ms-bar__handle"
      @pointerdown="onHandlePointerDown"
      @pointermove="onHandlePointerMove"
      @pointerup="onHandlePointerUp"
      @pointercancel="onHandlePointerUp"
    >
      <span class="ms-bar__handle-bar" />
    </div>

    <div class="ms-bar__top-row">
      <div class="ms-bar__count">Выбрано: <span>{{ store.selectionCount }}</span></div>

      <div class="ms-bar__cluster">
        <button
          type="button"
          class="ms-bar__cluster-btn"
          :class="{ active: !anyVisible }"
          :aria-label="anyVisible ? 'Скрыть' : 'Показать'"
          :title="anyVisible ? 'Скрыть' : 'Показать'"
          @click="onToggleVisible"
        >
          <v-icon size="16">{{ anyVisible ? 'mdi-eye-outline' : 'mdi-eye-off-outline' }}</v-icon>
        </button>
        <button
          type="button"
          class="ms-bar__cluster-btn"
          :class="{ active: !anyUnlocked }"
          :aria-label="anyUnlocked ? 'Заблокировать' : 'Разблокировать'"
          :title="anyUnlocked ? 'Заблокировать' : 'Разблокировать'"
          @click="onToggleLocked"
        >
          <v-icon size="16">{{ anyUnlocked ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline' }}</v-icon>
        </button>

        <div class="ms-bar__cluster-sep" />

        <button
          type="button"
          class="ms-bar__cluster-btn"
          :disabled="store.selectionCount === 0"
          aria-label="На слой назад"
          title="На слой назад"
          @click="onBackward"
        >
          <v-icon size="16">mdi-arrange-send-backward</v-icon>
        </button>
        <button
          type="button"
          class="ms-bar__cluster-btn"
          :disabled="store.selectionCount === 0"
          aria-label="На слой вперед"
          title="На слой вперед"
          @click="onForward"
        >
          <v-icon size="16">mdi-arrange-bring-forward</v-icon>
        </button>
      </div>
    </div>

    <div class="ms-bar__grid">
      <button
        type="button"
        class="ms-bar__btn ms-bar__btn--full"
        :disabled="store.selectionCount < 2"
        @click="onGroup"
      >
        <v-icon size="20">mdi-group</v-icon>
        Группировать
      </button>
      <button type="button" class="ms-bar__btn" :disabled="store.selectionCount === 0" @click="onDuplicate">
        <v-icon size="20">mdi-content-copy</v-icon>
        Копировать
      </button>
      <button type="button" class="ms-bar__btn ms-bar__btn--danger" :disabled="store.selectionCount === 0" @click="onDelete">
        <v-icon size="20">mdi-delete-outline</v-icon>
        Удалить
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useEditorStore } from '../store/editor.store'

const store = useEditorStore()
const barRootRef = ref<HTMLElement | null>(null)

const anyVisible = computed(() => store.selectedElements.some((element) => element.visible))
const anyUnlocked = computed(() => store.selectedElements.some((element) => !element.locked))

function onToggleVisible(): void {
  const next = !anyVisible.value
  for (const element of store.selectedElements) {
    store.setElementVisible(element.id, next)
  }
}

function onToggleLocked(): void {
  const next = anyUnlocked.value
  for (const element of store.selectedElements) {
    store.setElementLocked(element.id, next)
  }
}

function onGroup(): void {
  if (store.selectionCount < 2) {
    return
  }

  store.groupSelection()
  store.exitMultiSelectMode()
}

function onForward(): void {
  for (const element of store.selectedElements) {
    store.moveElementLayer(element.id, 'up')
  }
}

function onBackward(): void {
  for (const element of store.selectedElements) {
    store.moveElementLayer(element.id, 'down')
  }
}

function onDuplicate(): void {
  if (store.previewMode) {
    return
  }

  store.duplicateElement()
}

function onDelete(): void {
  if (store.selectionCount === 0) {
    return
  }

  const impactCount = store.getRemovalImpactCount(store.selectedElementIds)
  if (impactCount > 0 && !window.confirm(`Удалить группу и ${impactCount} вложенных объектов?`)) {
    return
  }

  store.removeSelectedElements()
}

// Swipe-down on the handle exits multi-select mode entirely (matches the other mobile docks'
// close gesture) — unlike those docks, this bar has no separate "collapsed" state to fall back
// to, so closing it always means leaving the mode and dropping the selection.
const CLOSE_DRAG_THRESHOLD = 90
const CLOSE_DRAG_VELOCITY = 0.5

const dockDragOffset = ref(0)
const dockDragging = ref(false)
let dockDragStartY = 0
let dockDragStartTime = 0

const dockDragStyle = computed(() => ({
  transform: dockDragOffset.value ? `translateY(${dockDragOffset.value}px)` : undefined,
  transition: dockDragging.value ? 'none' : undefined,
}))

function exitMultiSelect(): void {
  store.exitMultiSelectMode()
  store.clearSelection()
}

// Tapping outside the bar closes it — EXCEPT taps on the canvas itself, which is where you
// actually build the selection while this bar is open (toggling elements in/out, or clearing it
// via a background tap that already has its own handling). Excluding it is what stops every
// canvas tap from instantly closing the bar before the toggle-select logic gets a chance to run.
function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Node | null
  if (!target) {
    return
  }

  if (barRootRef.value?.contains(target)) {
    return
  }

  if (target instanceof Element && target.closest('.editor-page__canvas')) {
    return
  }

  exitMultiSelect()
}

// Reports this bar's live height to the store — shared with EditorMobilePropertiesDock.vue and
// EditorMobileLeftDock.vue, which are mutually exclusive with this one (only one bottom mobile
// panel is ever mounted at a time). Used by EditorCanvas.vue to keep floating UI (e.g. the spread
// pagination dots) clear of whichever panel is currently open.
let dockResizeObserver: ResizeObserver | null = null

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)

  if (barRootRef.value) {
    dockResizeObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height !== undefined) {
        store.setMobileDockOccludedHeight(height)
      }
    })
    dockResizeObserver.observe(barRootRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  dockResizeObserver?.disconnect()
  store.setMobileDockOccludedHeight(0)
})

function onHandlePointerDown(event: PointerEvent): void {
  dockDragging.value = true
  dockDragStartY = event.clientY
  dockDragStartTime = Date.now()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent): void {
  if (!dockDragging.value) {
    return
  }

  dockDragOffset.value = Math.max(0, event.clientY - dockDragStartY)
}

function onHandlePointerUp(): void {
  if (!dockDragging.value) {
    return
  }

  dockDragging.value = false

  const distance = dockDragOffset.value
  const elapsed = Math.max(Date.now() - dockDragStartTime, 1)
  const velocity = distance / elapsed
  const shouldClose = distance > CLOSE_DRAG_THRESHOLD || velocity > CLOSE_DRAG_VELOCITY

  dockDragOffset.value = 0

  if (shouldClose) {
    exitMultiSelect()
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.ms-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: $white;
  border-top: 1px solid pp.$border-strong;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 20px rgba(13, 13, 13, 0.08);
  transition: transform 0.2s ease;
}

.ms-bar__handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
  touch-action: none;
  cursor: grab;
}

.ms-bar__handle-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: pp.$border-strong;
}

.ms-bar__top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 20px 16px;
}

.ms-bar__count {
  font-size: 15px;
  font-weight: $font-weight-semibold;
  color: pp.$ink;

  span {
    color: pp.$accent-deep;
  }
}

.ms-bar__cluster {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1px solid pp.$border;
  border-radius: 10px;
  padding: 3px;
}

.ms-bar__cluster-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: none;
  color: pp.$ink-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;

  // Hover-only feedback, gated to real pointer devices — on touch, :hover applies on tap and
  // has no "mouse leaves" event to clear it, so a plain :hover rule here would leave one-shot
  // buttons (На слой назад/вперед) looking permanently "lit up" as if they were toggled on.
  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: pp.$accent-tint;
      color: pp.$accent-deep;
    }
  }

  // :active covers touch instead — it only applies while actually pressed and clears the
  // instant the finger lifts, so it can't get "stuck" the way :hover does on touch devices.
  &:active:not(:disabled) {
    background: pp.$accent-tint;
    color: pp.$accent-deep;
  }

  &.active {
    background: pp.$accent;
    color: $white;

    @media (hover: hover) {
      &:hover {
        background: pp.$accent-deep;
      }
    }

    &:active {
      background: pp.$accent-deep;
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.ms-bar__cluster-sep {
  width: 1px;
  height: 20px;
  background: pp.$border;
  flex-shrink: 0;
  margin: 0 1px;
}

.ms-bar__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 20px calc(20px + env(safe-area-inset-bottom, 20px));
}

.ms-bar__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 66px;
  border: 1px solid pp.$border-strong;
  border-radius: 10px;
  background: $white;
  color: pp.$ink;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;

  &:hover:not(:disabled) {
    background: pp.$field-hover;
    border-color: pp.$ink-faint;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.ms-bar__btn--full {
  grid-column: 1 / -1;
  flex-direction: row;
  height: 52px;
  gap: 9px;
}

.ms-bar__btn--danger {
  color: #b23b54;

  &:hover:not(:disabled) {
    background: rgba(178, 59, 84, 0.06);
    border-color: #b23b54;
  }
}
</style>
