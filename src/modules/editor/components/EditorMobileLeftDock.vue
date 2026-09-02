<template>
  <div ref="dockRootRef" class="mobile-left-dock" :style="dockDragStyle">

    <div
      v-if="expanded"
      class="mobile-left-dock__handle"
      @pointerdown="onHandlePointerDown"
      @pointermove="onHandlePointerMove"
      @pointerup="onHandlePointerUp"
      @pointercancel="onHandlePointerUp"
    >
      <span class="mobile-left-dock__handle-bar" />
    </div>

    <div class="mobile-left-dock__expand" :class="{ 'mobile-left-dock__expand--open': expanded }">
      <div class="mobile-left-dock__scroll">
        <EditorLayersPanel v-if="activeCategory === 'layers'" />
        <EditorLibraryPanel v-else :category="activeCategory" />
      </div>
    </div>

    <div class="mobile-left-dock__chip-strip">

      <button
        type="button"
        class="mobile-left-dock__chip"
        :class="{ active: activeCategory === 'photo' && expanded }"
        @click="onChipClick('photo')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 15l-5-5-9 9" /></svg>
        <span>Фото</span>
      </button>

      <button
        type="button"
        class="mobile-left-dock__chip"
        :class="{ active: activeCategory === 'text' && expanded }"
        @click="onChipClick('text')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 6h16M12 6v13" /></svg>
        <span>Текст</span>
      </button>

      <button
        type="button"
        class="mobile-left-dock__chip"
        :class="{ active: activeCategory === 'shape' && expanded }"
        @click="onChipClick('shape')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="4" width="7" height="7" /><circle cx="16.5" cy="7.5" r="3.5" /><path d="M4 20l6-9 5 6 3-4 2 3" /></svg>
        <span>Фигуры</span>
      </button>

      <button
        type="button"
        class="mobile-left-dock__chip"
        :class="{ active: activeCategory === 'layers' && expanded }"
        @click="onChipClick('layers')"
      >
        <span class="mobile-left-dock__chip-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>
          <span v-if="store.elements.length" class="mobile-left-dock__badge">{{ store.elements.length }}</span>
        </span>
        <span>Слои</span>
      </button>

      <button
        type="button"
        class="mobile-left-dock__chip"
        @click="store.requestPageProperties()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
        <span>Страница</span>
      </button>

    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useEditorStore } from '../store/editor.store'
import type { LibraryElementCategory } from '../factories/create-element.factory'
import EditorLayersPanel from './EditorLayersPanel.vue'
import EditorLibraryPanel from './EditorLibraryPanel.vue'

type RailKey = LibraryElementCategory | 'layers'

const store = useEditorStore()

const activeCategory = ref<RailKey>('photo')
const expanded = ref(false)
const dockRootRef = ref<HTMLElement | null>(null)

function onDocumentPointerDown(event: PointerEvent): void {
  if (!expanded.value) {
    return
  }

  const target = event.target as Node | null
  if (dockRootRef.value && target && !dockRootRef.value.contains(target)) {
    expanded.value = false
  }
}

// Reports this dock's live height to the store — shared with EditorMobilePropertiesDock.vue and
// EditorMobileMultiSelectBar.vue, which are mutually exclusive with this one (only one bottom
// mobile panel is ever mounted at a time), so they can all safely feed the same store field. Used
// by EditorCanvas.vue to keep floating UI (e.g. the spread pagination dots) clear of whichever
// panel is currently open.
let dockResizeObserver: ResizeObserver | null = null

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)

  if (dockRootRef.value) {
    dockResizeObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height !== undefined) {
        store.setMobileDockOccludedHeight(height)
      }
    })
    dockResizeObserver.observe(dockRootRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  dockResizeObserver?.disconnect()
  store.setMobileDockOccludedHeight(0)
})

function onChipClick(id: RailKey): void {
  if (activeCategory.value === id && expanded.value) {
    expanded.value = false
    return
  }

  activeCategory.value = id
  expanded.value = true
}

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
    expanded.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.mobile-left-dock {
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
  max-height: 70vh;
  transition: transform 0.2s ease;
}

.mobile-left-dock__handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
  touch-action: none;
  cursor: grab;
}

.mobile-left-dock__handle-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: pp.$border-strong;
}

.mobile-left-dock__expand {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1);

  &--open {
    max-height: 55vh;
    border-bottom: 1px solid pp.$border;
  }
}

.mobile-left-dock__scroll {
  max-height: 55vh;
  overflow-y: auto;
}

.mobile-left-dock__chip-strip {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 8px));
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mobile-left-dock__chip {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: 12px;
  color: pp.$ink-soft;
  border: none;
  background: none;
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
  }

  span {
    font-size: 9.5px;
    font-weight: 500;
    white-space: nowrap;
  }

  &.active {
    color: pp.$accent-deep;
    background: pp.$accent-tint;
  }
}

.mobile-left-dock__chip-icon-wrap {
  position: relative;
  display: inline-flex;
}

.mobile-left-dock__badge {
  position: absolute;
  top: -6px;
  right: -10px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: pp.$accent;
  color: $white;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
}
</style>
