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

    <div class="ms-bar__body">
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

    <div class="ms-bar__layout">
      <p class="ms-bar__layout-title">Между собой</p>
      <div
        v-for="(row, rowIndex) in relativeAlignRows"
        :key="`rel-${rowIndex}`"
        class="ms-bar__icon-row"
      >
        <button
          v-for="action in row"
          :key="action.mode"
          type="button"
          class="ms-bar__icon-btn"
          :aria-label="action.label"
          :title="action.label"
          :disabled="store.previewMode || store.alignableSelectedElements.length < action.min"
          @click="alignMulti(action.mode)"
        >
          <v-icon size="20">{{ action.icon }}</v-icon>
        </button>
      </div>

      <p class="ms-bar__layout-title">Отступы между элементами</p>
      <p class="ms-bar__hint">
        Между соседними элементами на холсте. Измените значение — отступ применится от якорного элемента.
      </p>
      <div class="ms-bar__gaps">
        <label class="ms-bar__gap">
          <span>Горизонтально</span>
          <span class="ms-bar__gap-field">
            <input
              :value="horizontalGapDraft"
              type="number"
              inputmode="decimal"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @focus="horizontalGapFocused = true"
              @blur="onHorizontalGapBlur"
              @keyup.enter="onHorizontalGapBlur"
              @input="onHorizontalGapChange(($event.target as HTMLInputElement).value)"
            />
            <span class="ms-bar__gap-suffix">px</span>
          </span>
        </label>
        <label class="ms-bar__gap">
          <span>Вертикально</span>
          <span class="ms-bar__gap-field">
            <input
              :value="verticalGapDraft"
              type="number"
              inputmode="decimal"
              :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
              @focus="verticalGapFocused = true"
              @blur="onVerticalGapBlur"
              @keyup.enter="onVerticalGapBlur"
              @input="onVerticalGapChange(($event.target as HTMLInputElement).value)"
            />
            <span class="ms-bar__gap-suffix">px</span>
          </span>
        </label>
      </div>

      <p class="ms-bar__layout-title">{{ store.groupEditingId ? 'В группе' : 'На странице' }}</p>
      <p class="ms-bar__hint">{{ frameLayoutHint }}</p>

      <div v-if="!store.groupEditingId" class="ms-bar__frame-options">
        <div
          v-if="store.isSpreadPage"
          class="ms-bar__segment"
          role="group"
          aria-label="Кадр раскладки"
        >
          <button
            type="button"
            class="ms-bar__segment-btn"
            :class="{ 'ms-bar__segment-btn--active': frameTarget === 'page' }"
            :aria-pressed="frameTarget === 'page'"
            @click="frameTarget = 'page'"
          >
            Страница
          </button>
          <button
            type="button"
            class="ms-bar__segment-btn"
            :class="{ 'ms-bar__segment-btn--active': frameTarget === 'spread' }"
            :aria-pressed="frameTarget === 'spread'"
            @click="frameTarget = 'spread'"
          >
            Разворот
          </button>
        </div>
        <EditorSwitch
          :model-value="useSafeMargin"
          label="С учётом поля печати"
          size="large"
          @update:model-value="useSafeMargin = $event"
        />
      </div>

      <div
        v-for="(row, rowIndex) in frameAlignRows"
        :key="`frame-${rowIndex}`"
        class="ms-bar__icon-row"
      >
        <button
          v-for="action in row"
          :key="action.mode"
          type="button"
          class="ms-bar__icon-btn"
          :aria-label="action.label"
          :title="action.label"
          :disabled="store.previewMode || store.alignableSelectedElements.length < 1"
          @click="alignToFrame(action.mode)"
        >
          <v-icon size="20">{{ action.icon }}</v-icon>
        </button>
      </div>

      <div class="ms-bar__icon-row">
        <button
          type="button"
          class="ms-bar__icon-btn"
          aria-label="Равные промежутки по ширине кадра"
          title="Равные промежутки по ширине кадра"
          :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
          @click="distributeInPage('horizontal')"
        >
          <v-icon size="20">mdi-arrow-expand-horizontal</v-icon>
        </button>
        <button
          type="button"
          class="ms-bar__icon-btn"
          aria-label="Равные промежутки по высоте кадра"
          title="Равные промежутки по высоте кадра"
          :disabled="store.previewMode || store.alignableSelectedElements.length < 2"
          @click="distributeInPage('vertical')"
        >
          <v-icon size="20">mdi-arrow-expand-vertical</v-icon>
        </button>
      </div>

      <p class="ms-bar__hint">Собрать с зазором из полей выше и отцентровать блок в кадре.</p>
      <div class="ms-bar__segment">
        <button
          type="button"
          class="ms-bar__segment-btn"
          :disabled="packDisabled('horizontal')"
          @click="packInPage('horizontal')"
        >
          В ряд
        </button>
        <button
          type="button"
          class="ms-bar__segment-btn"
          :disabled="packDisabled('vertical')"
          @click="packInPage('vertical')"
        >
          В колонку
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
      <button
        v-if="isTemplateEditor"
        type="button"
        class="ms-bar__btn ms-bar__btn--full"
        :disabled="store.selectionCount < 2 || store.previewMode"
        @click="onMakeList"
      >
        <v-icon size="20">mdi-format-list-numbered</v-icon>
        Сделать списком
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

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import EditorSwitch from './EditorSwitch.vue'
import { useEditorStore } from '../store/editor.store'
import { createEditorQuestion, editorQuestions } from '../services/editor-questions'
import {
  getAverageHorizontalGap,
  getAverageVerticalGap,
  type FrameAlignMode,
  type LayoutFrameTarget,
  type MultiAlignMode,
  type SelectionLayoutOptions,
} from '../utils/align-elements.util'

const store = useEditorStore()
const barRootRef = ref<HTMLElement | null>(null)

interface RelativeAlignAction {
  mode: MultiAlignMode
  label: string
  icon: string
  min: number
}

interface FrameAlignAction {
  mode: FrameAlignMode
  label: string
  icon: string
}

const relativeAlignRows: RelativeAlignAction[][] = [
  [
    { mode: 'left', label: 'По левому краю', icon: 'mdi-format-horizontal-align-left', min: 2 },
    { mode: 'center-horizontal', label: 'По центру по горизонтали', icon: 'mdi-format-horizontal-align-center', min: 2 },
    { mode: 'right', label: 'По правому краю', icon: 'mdi-format-horizontal-align-right', min: 2 },
  ],
  [
    { mode: 'top', label: 'По верхнему краю', icon: 'mdi-format-vertical-align-top', min: 2 },
    { mode: 'center-vertical', label: 'По центру по вертикали', icon: 'mdi-format-vertical-align-center', min: 2 },
    { mode: 'bottom', label: 'По нижнему краю', icon: 'mdi-format-vertical-align-bottom', min: 2 },
  ],
  [
    { mode: 'distribute-horizontal', label: 'Распределить по горизонтали (3+)', icon: 'mdi-distribute-horizontal-center', min: 3 },
    { mode: 'distribute-vertical', label: 'Распределить по вертикали (3+)', icon: 'mdi-distribute-vertical-center', min: 3 },
  ],
]

const frameAlignRows: FrameAlignAction[][] = [
  [
    { mode: 'left', label: 'К левому краю кадра', icon: 'mdi-format-horizontal-align-left' },
    { mode: 'center-horizontal', label: 'По центру кадра по горизонтали', icon: 'mdi-format-horizontal-align-center' },
    { mode: 'right', label: 'К правому краю кадра', icon: 'mdi-format-horizontal-align-right' },
  ],
  [
    { mode: 'top', label: 'К верхнему краю кадра', icon: 'mdi-format-vertical-align-top' },
    { mode: 'center-vertical', label: 'По центру кадра по вертикали', icon: 'mdi-format-vertical-align-center' },
    { mode: 'bottom', label: 'К нижнему краю кадра', icon: 'mdi-format-vertical-align-bottom' },
  ],
]

const horizontalGapDraft = ref('')
const verticalGapDraft = ref('')
const horizontalGapFocused = ref(false)
const verticalGapFocused = ref(false)
const frameTarget = ref<LayoutFrameTarget>('page')
const useSafeMargin = ref(true)

const frameLayoutHint = computed(() => {
  if (store.groupEditingId) {
    return 'Кадр — рамка группы.'
  }

  if (store.isSpreadPage && frameTarget.value === 'spread') {
    return 'Кадр — весь разворот, сгиб его не делит.'
  }

  if (store.isSpreadPage) {
    return 'Левая и правая половины раскладываются отдельно и не переезжают через сгиб.'
  }

  return 'Кадр — страница.'
})

function layoutOptions(): SelectionLayoutOptions {
  return {
    target: frameTarget.value,
    safeMargin: useSafeMargin.value,
  }
}

function alignMulti(mode: MultiAlignMode): void {
  if (store.previewMode) {
    return
  }

  store.alignSelectedElements(mode)
}

function alignToFrame(mode: FrameAlignMode): void {
  if (store.previewMode) {
    return
  }

  store.alignSelectionToFrame(mode, layoutOptions())
}

function distributeInPage(axis: 'horizontal' | 'vertical'): void {
  if (store.previewMode) {
    return
  }

  store.distributeSelectionInFrame(axis, layoutOptions())
}

function gapDraftNumber(axis: 'horizontal' | 'vertical'): number | null {
  const raw = axis === 'horizontal' ? horizontalGapDraft.value : verticalGapDraft.value
  if (raw.trim() === '') {
    return null
  }

  const gap = Number(raw)
  return Number.isFinite(gap) ? gap : null
}

function packDisabled(axis: 'horizontal' | 'vertical'): boolean {
  return store.previewMode || store.alignableSelectedElements.length < 2 || gapDraftNumber(axis) == null
}

function packInPage(axis: 'horizontal' | 'vertical'): void {
  const gap = gapDraftNumber(axis)
  if (store.previewMode || gap == null) {
    return
  }

  store.packSelectionInFrame(axis, gap, layoutOptions())
}

function syncGapDrafts(): void {
  if (!horizontalGapFocused.value) {
    const gap = getAverageHorizontalGap(store.alignableSelectedElements)
    horizontalGapDraft.value = gap !== null ? String(gap) : ''
  }

  if (!verticalGapFocused.value) {
    const gap = getAverageVerticalGap(store.alignableSelectedElements)
    verticalGapDraft.value = gap !== null ? String(gap) : ''
  }
}

function onHorizontalGapChange(value: string): void {
  horizontalGapDraft.value = value
  const gap = Number(value)
  if (value.trim() === '' || !Number.isFinite(gap) || store.alignableSelectedElements.length < 2) {
    return
  }

  store.applyDistributionGap('horizontal', gap)
}

function onVerticalGapChange(value: string): void {
  verticalGapDraft.value = value
  const gap = Number(value)
  if (value.trim() === '' || !Number.isFinite(gap) || store.alignableSelectedElements.length < 2) {
    return
  }

  store.applyDistributionGap('vertical', gap)
}

function onHorizontalGapBlur(): void {
  horizontalGapFocused.value = false
  syncGapDrafts()
}

function onVerticalGapBlur(): void {
  verticalGapFocused.value = false
  syncGapDrafts()
}

watch(
  () =>
    store.alignableSelectedElements
      .map(
        (element) =>
          `${element.id}:${element.position.x},${element.position.y},${element.size.width},${element.size.height}`,
      )
      .join('|'),
  () => {
    syncGapDrafts()
  },
  { immediate: true },
)

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

/** Same gate as the list settings themselves (EditorListSection.vue) — template editor only. */
const isTemplateEditor = computed(() => editorQuestions.value.length > 0 || createEditorQuestion.value !== null)

/** Each selected element becomes a row; the first row is then selected, so the properties dock
 * opens on it with its "Список" chip. */
function onMakeList(): void {
  const listId = store.makeList([...store.selectedElementIds])
  const first = listId ? store.findListById(listId)?.rows[0] : null
  store.exitMultiSelectMode()
  if (first) {
    store.selectFromLayersPanel(first.node.id)
  }
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
  max-height: 30vh;
  background: $white;
  border-top: 1px solid pp.$border-strong;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 20px rgba(13, 13, 13, 0.08);
  transition: transform 0.2s ease;
}

.ms-bar__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
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

.ms-bar__layout {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 20px 16px;
}

.ms-bar__layout-title {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: pp.$ink;
}

.ms-bar__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: pp.$ink-soft;
}

.ms-bar__icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ms-bar__icon-btn {
  width: 40px;
  height: 40px;
  border: 1px solid pp.$border-strong;
  border-radius: 999px;
  background: $white;
  color: pp.$ink;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: pp.$field-hover;
      border-color: pp.$ink-faint;
    }
  }

  &:active:not(:disabled) {
    background: pp.$accent-tint;
    color: pp.$accent-deep;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.ms-bar__gaps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ms-bar__gap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: pp.$ink-soft;
}

.ms-bar__gap-field {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  border: 1px solid pp.$border-strong;
  border-radius: 10px;
  background: $white;

  input {
    width: 100%;
    min-width: 0;
    border: none;
    background: none;
    color: pp.$ink;
    font: inherit;
    font-size: 14px;

    &:focus {
      outline: none;
    }

    &:disabled {
      opacity: 0.4;
    }
  }
}

.ms-bar__gap-suffix {
  flex-shrink: 0;
  font-size: 12px;
  color: pp.$ink-soft;
}

.ms-bar__frame-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ms-bar__segment {
  display: flex;
  padding: 3px;
  border: 1px solid pp.$border;
  border-radius: 10px;
  background: pp.$field-hover;
}

.ms-bar__segment-btn {
  flex: 1;
  min-height: 36px;
  border: none;
  border-radius: 8px;
  background: none;
  color: pp.$ink-soft;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &--active {
    background: $white;
    color: pp.$ink;
    box-shadow: 0 1px 2px rgba(13, 13, 13, 0.08);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
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
