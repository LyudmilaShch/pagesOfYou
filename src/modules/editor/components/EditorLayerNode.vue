<template>
  <li class="editor-layer-node">
    <div
      ref="rowRef"
      class="editor-layer-node__row"
      :style="{ paddingLeft: `${8 + depth * 16}px` }"
      :class="{
        'editor-layer-node__row--selected': store.isElementSelected(element.id),
        'editor-layer-node__row--hidden': !element.visible,
        'editor-layer-node__row--drop-inside':
          dragContext.dragOverInfo.value?.id === element.id &&
          dragContext.dragOverInfo.value.zone === 'inside',
      }"
      :draggable="!store.previewMode"
      @click="handleSelect"
      @dragstart="handleDragStart"
      @dragover.prevent="handleDragOver"
      @dragleave="dragContext.leaveRow(element.id)"
      @drop.prevent="dragContext.dropOnRow(element.id)"
      @dragend="dragContext.endDrag()"
    >
      <span
        v-if="dragContext.dragOverInfo.value?.id === element.id && dragContext.dragOverInfo.value.zone === 'before'"
        class="editor-layer-node__drop-line editor-layer-node__drop-line--before"
      />

      <button
        v-if="isGroup"
        type="button"
        class="editor-layer-node__chevron"
        :class="{ 'editor-layer-node__chevron--collapsed': !expanded }"
        @click.stop="expanded = !expanded"
      >
        <v-icon size="16">mdi-chevron-down</v-icon>
      </button>
      <span v-else class="editor-layer-node__chevron-spacer" />

      <span class="editor-layer-node__drag-handle" aria-hidden="true">
        <v-icon size="16">mdi-drag-vertical</v-icon>
      </span>

      <span class="editor-layer-node__type-icon">
        <v-icon size="16">{{ getElementMeta(element.type).icon }}</v-icon>
      </span>

      <input
        v-if="renaming"
        ref="renameInputRef"
        v-model="renameDraft"
        class="editor-layer-node__rename-input"
        @click.stop
        @keydown.enter="commitRename"
        @keydown.escape="cancelRename"
        @blur="commitRename"
      />
      <span v-else class="editor-layer-node__name" @dblclick.stop="startRename">
        {{ element.name }}
      </span>

      <div class="editor-layer-node__actions">
        <button
          type="button"
          class="editor-layer-node__action"
          :title="element.visible ? 'Скрыть' : 'Показать'"
          @click.stop="store.setElementVisible(element.id, !element.visible)"
        >
          <v-icon size="16">
            {{ element.visible ? 'mdi-eye-outline' : 'mdi-eye-off-outline' }}
          </v-icon>
        </button>

        <button
          type="button"
          class="editor-layer-node__action"
          :title="element.locked ? 'Разблокировать' : 'Заблокировать'"
          @click.stop="store.setElementLocked(element.id, !element.locked)"
        >
          <v-icon size="16">
            {{ element.locked ? 'mdi-lock-outline' : 'mdi-lock-open-outline' }}
          </v-icon>
        </button>
      </div>

      <span
        v-if="dragContext.dragOverInfo.value?.id === element.id && dragContext.dragOverInfo.value.zone === 'after'"
        class="editor-layer-node__drop-line editor-layer-node__drop-line--after"
      />
    </div>

    <ul v-if="isGroup && expanded" class="editor-layer-node__children">
      <EditorLayerNode
        v-for="child in reversedChildren"
        :key="child.id"
        :element="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'

import type { GroupElement, PageElement } from '../models'
import { isGroupElement } from '../models'
import { getElementMeta } from '../constants/element-meta.constants'
import { useEditorStore } from '../store/editor.store'
import { LAYERS_DRAG_CONTEXT_KEY } from './layers-drag.context'

const props = defineProps<{
  element: PageElement
  depth: number
}>()

const store = useEditorStore()
const dragContext = inject(LAYERS_DRAG_CONTEXT_KEY)!

const rowRef = ref<HTMLElement | null>(null)
const expanded = ref(true)
const renaming = ref(false)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const isGroup = computed(() => isGroupElement(props.element))
const reversedChildren = computed(() =>
  isGroupElement(props.element) ? [...(props.element as GroupElement).children].reverse() : [],
)

function handleSelect(event: MouseEvent): void {
  if (store.previewMode) {
    return
  }

  if (event.shiftKey) {
    store.toggleElementSelection(props.element.id)
    return
  }

  store.selectFromLayersPanel(props.element.id)
}

function handleDragStart(event: DragEvent): void {
  dragContext.startDrag(props.element.id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', props.element.id)
  }
}

function handleDragOver(event: DragEvent): void {
  dragContext.overRow(props.element.id, isGroup.value, event, rowRef.value)
}

function startRename(): void {
  renameDraft.value = props.element.name
  renaming.value = true
  void nextTick(() => renameInputRef.value?.focus())
}

function commitRename(): void {
  if (!renaming.value) {
    return
  }
  renaming.value = false
  store.renameElement(props.element.id, renameDraft.value)
}

function cancelRename(): void {
  renaming.value = false
}
</script>

<style scoped lang="scss">
.editor-layer-node__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-2 $spacing-2 8px;
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

  &--drop-inside {
    border-color: $text-primary;
    background: $state-hover-bg;
  }
}

.editor-layer-node__drop-line {
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  background: $text-primary;

  &--before {
    top: -1px;
  }

  &--after {
    bottom: -1px;
  }
}

.editor-layer-node__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: $text-secondary;
  cursor: pointer;
  transition: transform 0.15s ease;
  flex-shrink: 0;

  &--collapsed {
    transform: rotate(-90deg);
  }
}

.editor-layer-node__chevron-spacer {
  display: inline-block;
  width: 18px;
  flex-shrink: 0;
}

.editor-layer-node__drag-handle {
  display: inline-flex;
  color: $text-muted;
  cursor: grab;
  flex-shrink: 0;
}

.editor-layer-node__type-icon {
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

.editor-layer-node__name {
  flex: 1;
  min-width: 0;
  font-size: $font-size-body-sm;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-layer-node__rename-input {
  flex: 1;
  min-width: 0;
  font-size: $font-size-body-sm;
  color: $text-primary;
  background: $bg-elevated;
  border: 1px solid $border-default;
  border-radius: $radius-sm;
  padding: 1px 4px;
}

.editor-layer-node__actions {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}

.editor-layer-node__action {
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

.editor-layer-node__children {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
