<template>
  <div class="editor-left-panel">
    <nav class="editor-left-panel__rail" aria-label="Категории элементов">
      <button
        v-for="item in railItems"
        :key="item.key"
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === item.key }"
        @click="toggleCategory(item.key)"
      >
        <v-icon size="20">{{ item.icon }}</v-icon>
        <span>{{ item.label }}</span>
        <span v-if="item.key === 'layers' && store.elements.length" class="editor-left-panel__badge">
          {{ store.elements.length }}
        </span>
      </button>
    </nav>

    <div v-if="activeCategory" class="editor-left-panel__flyout">
      <EditorLibraryPanel v-if="activeCategory !== 'layers'" :category="activeCategory" />
      <EditorLayersPanel v-else />

      <button
        type="button"
        class="editor-left-panel__collapse"
        aria-label="Свернуть панель"
        @click="activeCategory = null"
      >
        <v-icon size="16">mdi-chevron-left</v-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import EditorLayersPanel from './EditorLayersPanel.vue'
import EditorLibraryPanel from './EditorLibraryPanel.vue'
import type { LibraryElementCategory } from '../factories/create-element.factory'
import { useEditorStore } from '../store/editor.store'

type RailKey = LibraryElementCategory | 'layers'

const emit = defineEmits<{
  expanded: [value: boolean]
}>()

const store = useEditorStore()
const activeCategory = ref<RailKey | null>('photo')

const railItems: { key: RailKey; label: string; icon: string }[] = [
  { key: 'photo', label: 'Фото', icon: 'mdi-image-outline' },
  { key: 'text', label: 'Текст', icon: 'mdi-format-text' },
  { key: 'shape', label: 'Фигуры', icon: 'mdi-shape-outline' },
  { key: 'layers', label: 'Слои', icon: 'mdi-layers-outline' },
]

function toggleCategory(key: RailKey): void {
  activeCategory.value = activeCategory.value === key ? null : key
}

watch(activeCategory, (value) => emit('expanded', value !== null), { immediate: true })
</script>

<style scoped lang="scss">
.editor-left-panel {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: stretch;
  height: 100%;
}

.editor-left-panel__rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-shrink: 0;
  width: 84px;
  gap: $spacing-1;
  height: 100%;
  padding: $spacing-3 $spacing-2;
  border-right: 1px solid $border-light;
  background: $bg-primary;
  overflow-y: auto;
}

.editor-left-panel__rail-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-2 $spacing-1;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: $text-secondary;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: $state-hover-bg;
    color: $text-primary;
  }

  &--active {
    background: $bg-muted;
    color: $text-primary;
  }
}

.editor-left-panel__badge {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: $bg-inverse;
  color: $text-inverse;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.editor-left-panel__flyout {
  position: relative;
  flex-shrink: 0;
  width: 280px;
  height: 100%;
  border-right: 1px solid $border-light;
  background: $bg-primary;
  box-shadow: $shadow-lg;
}

.editor-left-panel__collapse {
  position: absolute;
  top: $spacing-4;
  right: -14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid $border-light;
  border-radius: 999px;
  background: $bg-elevated;
  color: $text-secondary;
  cursor: pointer;
  box-shadow: $shadow-sm;

  &:hover {
    color: $text-primary;
  }
}

@include mobile-only {
  .editor-left-panel__rail {
    flex-direction: row;
    justify-content: space-around;
  }

  .editor-left-panel__flyout {
    position: fixed;
    top: 64px;
    left: 0;
    width: 100%;
    height: calc(100vh - 64px);
  }
}
</style>
