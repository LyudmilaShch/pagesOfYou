<template>
  <div class="editor-page" :class="{ 'editor-page--left-expanded': leftPanelExpanded }">
    <EditorLeftPanel
      class="editor-page__panel editor-page__panel--left"
      @expanded="leftPanelExpanded = $event"
    />
    <section class="editor-page__canvas" aria-label="Холст редактора">
      <EditorCanvas />
    </section>
    <EditorPropertiesPanel class="editor-page__panel editor-page__panel--right" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import EditorCanvas from '../components/canvas/EditorCanvas.vue'
import EditorLeftPanel from '../components/EditorLeftPanel.vue'
import EditorPropertiesPanel from '../components/EditorPropertiesPanel.vue'

const leftPanelExpanded = ref(true)
</script>

<style scoped lang="scss">
.editor-page {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 320px;
  height: calc(100vh - 64px);
  min-height: 0;
  transition: grid-template-columns 0.18s ease;
}

.editor-page--left-expanded {
  grid-template-columns: 364px minmax(0, 1fr) 320px;
}

.editor-page__panel {
  min-height: 0;
}

.editor-page__canvas {
  min-width: 0;
  min-height: 0;
}

@include mobile-only {
  .editor-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(320px, 1fr) auto;
    height: auto;
    min-height: calc(100vh - 64px);
  }

  .editor-page__panel--left {
    order: 1;
    max-height: 220px;
  }

  .editor-page__canvas {
    order: 2;
    min-height: 420px;
  }

  .editor-page__panel--right {
    order: 3;
    max-height: 320px;
  }
}
</style>
