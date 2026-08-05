<template>
  <div
    class="editor-page"
    :class="{
      'editor-page--left-expanded': leftPanelExpanded,
      'editor-page--properties-open': store.showPropertiesPanel,
    }"
  >
    <EditorLeftPanel
      class="editor-page__panel editor-page__panel--left"
      @expanded="leftPanelExpanded = $event"
    />
    <EditorPropertiesPanel
      v-if="store.showPropertiesPanel"
      class="editor-page__panel editor-page__panel--properties"
    />
    <section class="editor-page__canvas" aria-label="Холст редактора">
      <EditorCanvas />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import EditorCanvas from '../components/canvas/EditorCanvas.vue'
import EditorLeftPanel from '../components/EditorLeftPanel.vue'
import EditorPropertiesPanel from '../components/EditorPropertiesPanel.vue'
import { useEditorStore } from '../store/editor.store'

const store = useEditorStore()
const leftPanelExpanded = ref(true)
</script>

<style scoped lang="scss">
.editor-page {
  // Both panels closed by default (e.g. left panel manually collapsed with nothing selected and
  // no page-properties request pending) — rail only, canvas gets the rest.
  display: grid;
  grid-template-columns: 84px 0 minmax(0, 1fr);
  height: calc(100vh - 64px);
  min-height: 0;
  // Matches the canvas background so the properties panel's margin gap (see
  // EditorPropertiesPanel.vue) doesn't read as a separate white "backing plate" behind it — the
  // floating panel sits directly on the same surface as the canvas.
  background: $bg-tertiary;
  transition: grid-template-columns 0.18s ease;
}

.editor-page--left-expanded {
  // 84px rail + 320px flyout — the flyout matches the properties column's width so the two
  // mutually exclusive panels are the same size. Mutually exclusive with the properties column
  // (enforced in the two components' watchers), but if that ever briefly disagrees,
  // --properties-open (declared after) wins.
  grid-template-columns: 404px 0 minmax(0, 1fr);
}

.editor-page--properties-open {
  grid-template-columns: 84px 320px minmax(0, 1fr);
}

.editor-page__panel {
  min-height: 0;
}

.editor-page__panel--left {
  grid-column: 1;
}

.editor-page__panel--properties {
  grid-column: 2;
  overflow: hidden;
}

.editor-page__canvas {
  grid-column: 3;
  min-width: 0;
  min-height: 0;
}

@include mobile-only {
  .editor-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(320px, 1fr);
    height: auto;
    min-height: calc(100vh - 64px);
  }

  .editor-page__panel--left,
  .editor-page__panel--properties,
  .editor-page__canvas {
    grid-column: 1;
  }

  .editor-page__panel--left {
    order: 1;
    max-height: 220px;
  }

  .editor-page__panel--properties {
    order: 2;
    max-height: 320px;
  }

  .editor-page__canvas {
    order: 3;
    min-height: 420px;
  }
}
</style>
