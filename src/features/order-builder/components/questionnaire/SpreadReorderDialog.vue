<template>
  <v-dialog :model-value="open" max-width="720" @update:model-value="$emit('close')">
    <v-card>
      <v-card-title>Порядок разворотов</v-card-title>
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

          <div
            v-for="(page, index) in spreadPages"
            :key="page.id"
            class="spread-reorder__item"
            :class="{
              'spread-reorder__item--dragging': draggingId === page.id,
              'spread-reorder__item--drag-over': dragOverId === page.id && draggingId !== page.id,
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
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="$emit('close')">Готово</v-btn>
      </v-card-actions>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { useOrderBuilderStore } from '../../stores/order-builder.store'
import type { JournalPage } from '../../types/order.types'

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
</script>

<style scoped lang="scss">
.spread-reorder__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
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
</style>
