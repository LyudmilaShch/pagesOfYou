<template>
  <aside class="editor-layers" aria-label="Слои страницы">
    <div class="editor-layers__header">
      <p class="editor-layers__eyebrow">Структура</p>
      <h2 class="editor-layers__title">Слои</h2>
      <p class="editor-layers__hint">Сверху — элементы ближе к зрителю</p>
    </div>

    <div v-if="store.elements.length === 0" class="editor-layers__empty">
      <v-icon size="28" color="grey">mdi-layers-outline</v-icon>
      <p>На странице пока нет элементов</p>
    </div>

    <ul v-else class="editor-layers__list">
      <EditorLayerNode
        v-for="element in reversedRootElements"
        :key="element.id"
        :element="element"
        :depth="0"
      />
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'

import { useEditorStore } from '../store/editor.store'
import { findNodeById, locateNode } from '../utils/element-tree.util'
import { isGroupElement } from '../models'
import EditorLayerNode from './EditorLayerNode.vue'
import {
  LAYERS_DRAG_CONTEXT_KEY,
  type LayersDragContext,
  type LayersDragOverInfo,
} from './layers-drag.context'

const store = useEditorStore()

const reversedRootElements = computed(() => [...store.elements].reverse())

const draggedId = ref<string | null>(null)
const dragOverInfo = ref<LayersDragOverInfo | null>(null)

function startDrag(id: string): void {
  draggedId.value = id
  dragOverInfo.value = null
}

function overRow(id: string, isGroup: boolean, event: DragEvent, rowEl: HTMLElement | null): void {
  if (!draggedId.value || draggedId.value === id || !rowEl) {
    return
  }

  const rect = rowEl.getBoundingClientRect()
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5

  let zone: LayersDragOverInfo['zone']
  if (isGroup) {
    zone = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
  } else {
    zone = ratio < 0.5 ? 'before' : 'after'
  }

  dragOverInfo.value = { id, zone }
}

function leaveRow(id: string): void {
  if (dragOverInfo.value?.id === id) {
    dragOverInfo.value = null
  }
}

function dropOnRow(targetId: string): void {
  const sourceId = draggedId.value
  const zone = dragOverInfo.value?.zone

  if (sourceId && sourceId !== targetId && zone) {
    const root = store.elements

    if (zone === 'inside') {
      const targetNode = findNodeById(root, targetId)
      if (targetNode && isGroupElement(targetNode)) {
        store.moveElementToParent(sourceId, targetId, targetNode.children.length)
      }
    } else {
      const targetLocation = locateNode(root, targetId)
      if (targetLocation) {
        const parentId = targetLocation.parent?.id ?? null
        const sourceLocation = locateNode(root, sourceId)
        let insertIndex = zone === 'before' ? targetLocation.index : targetLocation.index + 1

        // Removing the source first (if it's a sibling before the target) shifts later indices left.
        if (
          sourceLocation &&
          (sourceLocation.parent?.id ?? null) === parentId &&
          sourceLocation.index < targetLocation.index
        ) {
          insertIndex -= 1
        }

        store.moveElementToParent(sourceId, parentId, insertIndex)
      }
    }
  }

  endDrag()
}

function endDrag(): void {
  draggedId.value = null
  dragOverInfo.value = null
}

const dragContext: LayersDragContext = {
  draggedId,
  dragOverInfo,
  startDrag,
  overRow,
  leaveRow,
  dropOnRow,
  endDrag,
}

provide(LAYERS_DRAG_CONTEXT_KEY, dragContext)
</script>

<style scoped lang="scss">
.editor-layers {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-layers__header {
  padding: $spacing-4 $spacing-4 $spacing-3;
  border-bottom: 1px solid $border-light;
}

.editor-layers__eyebrow {
  margin: 0 0 $spacing-1;
  font-size: $font-size-caption;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
}

.editor-layers__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.editor-layers__hint {
  margin: $spacing-2 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-layers__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-3;
  padding: $spacing-8 $spacing-4;
  text-align: center;
  color: $text-muted;
  font-size: $font-size-body-sm;
}

.editor-layers__list {
  list-style: none;
  margin: 0;
  padding: $spacing-2;
  overflow-y: auto;
}
</style>
