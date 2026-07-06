<template>
  <aside class="editor-left-panel" aria-label="Панель редактора">
    <div class="editor-left-panel__tabs" role="tablist">
      <button
        type="button"
        class="editor-left-panel__tab"
        :class="{ 'editor-left-panel__tab--active': activeTab === 'library' }"
        role="tab"
        :aria-selected="activeTab === 'library'"
        @click="activeTab = 'library'"
      >
        <v-icon size="16">mdi-shape-outline</v-icon>
        Элементы
      </button>
      <button
        type="button"
        class="editor-left-panel__tab"
        :class="{ 'editor-left-panel__tab--active': activeTab === 'layers' }"
        role="tab"
        :aria-selected="activeTab === 'layers'"
        @click="activeTab = 'layers'"
      >
        <v-icon size="16">mdi-layers-outline</v-icon>
        Слои
        <span v-if="store.elements.length" class="editor-left-panel__badge">
          {{ store.elements.length }}
        </span>
      </button>
    </div>

    <div class="editor-left-panel__content">
      <EditorLibraryPanel v-show="activeTab === 'library'" />
      <EditorLayersPanel v-show="activeTab === 'layers'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import EditorLayersPanel from './EditorLayersPanel.vue'
import EditorLibraryPanel from './EditorLibraryPanel.vue'
import { useEditorStore } from '../store/editor.store'

const store = useEditorStore()
const activeTab = ref<'library' | 'layers'>('library')
</script>

<style scoped lang="scss">
.editor-left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid $border-light;
  background: $bg-primary;
}

.editor-left-panel__tabs {
  display: flex;
  gap: $spacing-1;
  padding: $spacing-3 $spacing-3 0;
  border-bottom: 1px solid $border-light;
}

.editor-left-panel__tab {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  flex: 1;
  justify-content: center;
  padding: $spacing-2 $spacing-3;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: $text-primary;
  }

  &--active {
    color: $text-primary;
    border-bottom-color: $text-primary;
  }
}

.editor-left-panel__badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: $bg-muted;
  font-size: $font-size-caption;
  line-height: 18px;
  text-align: center;
}

.editor-left-panel__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;

  > * {
    height: 100%;
  }
}
</style>
