<template>
  <aside class="editor-layers" aria-label="Слои страницы">
    <div class="editor-layers__header">
      <p class="editor-layers__eyebrow">Структура</p>
      <h2 class="editor-layers__title">Слои</h2>
      <p class="editor-layers__hint">Сверху — элементы ближе к зрителю</p>
    </div>

    <div v-if="store.layers.length === 0" class="editor-layers__empty">
      <v-icon size="28" color="grey">mdi-layers-outline</v-icon>
      <p>На странице пока нет элементов</p>
    </div>

    <ul v-else class="editor-layers__list">
      <li
        v-for="(element, index) in store.layers"
        :key="element.id"
        class="editor-layers__item"
        :class="{
          'editor-layers__item--selected': store.isElementSelected(element.id),
          'editor-layers__item--hidden': !element.visible,
          'editor-layers__item--drag-over': dragOverIndex === index,
        }"
        :draggable="!store.previewMode"
        @click="handleSelect(element.id, $event)"
        @dragstart="handleDragStart(index, $event)"
        @dragover.prevent="handleDragOver(index)"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop(index)"
        @dragend="handleDragEnd"
      >
        <span class="editor-layers__drag-handle" aria-hidden="true">
          <v-icon size="16">mdi-drag-vertical</v-icon>
        </span>

        <span class="editor-layers__type-icon">
          <v-icon size="16">{{ getElementMeta(element.type).icon }}</v-icon>
        </span>

        <span class="editor-layers__name">{{ element.name }}</span>

        <div class="editor-layers__actions">
          <button
            type="button"
            class="editor-layers__action"
            :title="element.visible ? 'Скрыть' : 'Показать'"
            @click.stop="toggleVisible(element.id, element.visible)"
          >
            <v-icon size="16">
              {{ element.visible ? 'mdi-eye-outline' : 'mdi-eye-off-outline' }}
            </v-icon>
          </button>

          <button
            type="button"
            class="editor-layers__action"
            :title="element.locked ? 'Разблокировать' : 'Заблокировать'"
            @click.stop="toggleLocked(element.id, element.locked)"
          >
            <v-icon size="16">
              {{ element.locked ? 'mdi-lock-outline' : 'mdi-lock-open-outline' }}
            </v-icon>
          </button>
        </div>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { getElementMeta } from '../constants/element-meta.constants'
import { useEditorStore } from '../store/editor.store'

const store = useEditorStore()

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function handleSelect(id: string, event?: MouseEvent): void {
  if (store.previewMode) {
    return
  }

  if (event?.shiftKey) {
    store.toggleElementSelection(id)
    return
  }

  store.selectElement(id)
}

function toggleVisible(id: string, visible: boolean): void {
  store.setElementVisible(id, !visible)
}

function toggleLocked(id: string, locked: boolean): void {
  store.setElementLocked(id, !locked)
}

function handleDragStart(index: number, event: DragEvent): void {
  dragFromIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function handleDragOver(index: number): void {
  dragOverIndex.value = index
}

function handleDragLeave(): void {
  dragOverIndex.value = null
}

function handleDrop(targetIndex: number): void {
  if (dragFromIndex.value === null || dragFromIndex.value === targetIndex) {
    resetDragState()
    return
  }

  const layerIds = store.layers.map((element) => element.id)
  const [movedId] = layerIds.splice(dragFromIndex.value, 1)
  layerIds.splice(targetIndex, 0, movedId)

  const orderedIds = [...layerIds].reverse()
  store.reorderElements(orderedIds)
  resetDragState()
}

function handleDragEnd(): void {
  resetDragState()
}

function resetDragState(): void {
  dragFromIndex.value = null
  dragOverIndex.value = null
}
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

.editor-layers__item {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-2;
  border: 1px solid transparent;
  border-radius: $radius-md;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: $state-hover-bg;
  }

  &--selected {
    background: $bg-muted;
    border-color: $border-default;
  }

  &--hidden {
    opacity: 0.55;
  }

  &--drag-over {
    border-color: $text-primary;
    background: $state-hover-bg;
  }
}

.editor-layers__drag-handle {
  display: inline-flex;
  color: $text-muted;
  cursor: grab;
}

.editor-layers__type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: $radius-sm;
  background: $bg-muted;
  color: $text-primary;
  flex-shrink: 0;
}

.editor-layers__name {
  flex: 1;
  min-width: 0;
  font-size: $font-size-body-sm;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-layers__actions {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}

.editor-layers__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  cursor: pointer;

  &:hover {
    background: $bg-elevated;
    color: $text-primary;
  }
}
</style>
