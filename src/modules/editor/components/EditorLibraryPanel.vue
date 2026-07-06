<template>
  <aside class="editor-library" aria-label="Библиотека элементов">
    <div class="editor-library__header">
      <p class="editor-library__eyebrow">Библиотека</p>
      <h2 class="editor-library__title">Элементы</h2>
    </div>

    <div class="editor-library__list">
      <button
        v-for="item in LIBRARY_ELEMENTS"
        :key="item.type"
        type="button"
        class="editor-library__item"
        :disabled="store.previewMode"
        @click="handleAdd(item.type)"
      >
        <span class="editor-library__item-icon">
          <v-icon size="18">{{ item.icon }}</v-icon>
        </span>
        <span class="editor-library__item-content">
          <span class="editor-library__item-label">{{ item.label }}</span>
          <span class="editor-library__item-description">{{ item.description }}</span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { LIBRARY_ELEMENTS } from '../factories/create-element.factory'
import type { LibraryElementType } from '../factories/create-element.factory'
import { useEditorStore } from '../store/editor.store'

const store = useEditorStore()

function handleAdd(type: LibraryElementType): void {
  if (store.previewMode) {
    return
  }
  store.addElement(type)
}
</script>

<style scoped lang="scss">
.editor-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $bg-primary;
}

.editor-library__header {
  padding: $spacing-6 $spacing-4 $spacing-4;
  border-bottom: 1px solid $border-light;
}

.editor-library__eyebrow {
  margin: 0 0 $spacing-1;
  font-size: $font-size-caption;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
}

.editor-library__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.editor-library__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-4;
  overflow-y: auto;
}

.editor-library__item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  width: 100%;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;

  &:hover:not(:disabled) {
    background: $state-hover-bg;
    border-color: $border-default;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.editor-library__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  background: $bg-muted;
  color: $text-primary;
  flex-shrink: 0;
}

.editor-library__item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.editor-library__item-label {
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.editor-library__item-description {
  font-size: $font-size-caption;
  color: $text-muted;
}
</style>
