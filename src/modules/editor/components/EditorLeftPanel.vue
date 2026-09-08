<template>
  <div class="editor-left-panel">
    <nav class="editor-left-panel__rail" aria-label="Категории элементов">
      <button
        v-for="category in editorLeftPanelExtraCategories"
        :key="category.key"
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === category.key }"
        @click="toggleCategory(category.key)"
      >
        <v-icon size="18">{{ category.icon }}</v-icon>
        <span>{{ category.label }}</span>
      </button>

      <button
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === 'photo' }"
        @click="toggleCategory('photo')"
      >
        <svg class="editor-left-panel__rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="M21 15l-5-5-9 9" />
        </svg>
        <span>Фото</span>
      </button>

      <button
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === 'text' }"
        @click="toggleCategory('text')"
      >
        <svg class="editor-left-panel__rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4 6h16M12 6v13" />
        </svg>
        <span>Текст</span>
      </button>

      <button
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === 'shape' }"
        @click="toggleCategory('shape')"
      >
        <svg class="editor-left-panel__rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="4" y="4" width="7" height="7" />
          <circle cx="16.5" cy="7.5" r="3.5" />
          <path d="M4 20l6-9 5 6 3-4 2 3" />
        </svg>
        <span>Фигуры</span>
      </button>

      <button
        type="button"
        class="editor-left-panel__rail-btn"
        :class="{ 'editor-left-panel__rail-btn--active': activeCategory === 'layers' }"
        @click="toggleCategory('layers')"
      >
        <span class="editor-left-panel__rail-icon-wrap">
          <svg class="editor-left-panel__rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M12 3l9 5-9 5-9-5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
          <span v-if="store.elements.length" class="editor-left-panel__badge">
            {{ store.elements.length }}
          </span>
        </span>
        <span>Слои</span>
      </button>
    </nav>

    <div v-if="activeCategory" class="editor-left-panel__flyout">
      <EditorLayersPanel v-if="activeCategory === 'layers'" />
      <component :is="activeExtraCategory.panel" v-else-if="activeExtraCategory" />
      <EditorLibraryPanel v-else :category="(activeCategory as LibraryElementCategory)" />

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
import { computed, ref, watch } from 'vue'

import EditorLayersPanel from './EditorLayersPanel.vue'
import EditorLibraryPanel from './EditorLibraryPanel.vue'
import type { LibraryElementCategory } from '../factories/create-element.factory'
import { useEditorStore } from '../store/editor.store'
import { editorLeftPanelExtraCategories } from '../services/editor-left-panel-extra-category'

type RailKey = LibraryElementCategory | 'layers' | string

const emit = defineEmits<{
  expanded: [value: boolean]
}>()

const store = useEditorStore()
// Opens straight into the first registered extra category (e.g. the order builder's
// "Структура") when any are registered — otherwise the usual default. Reads the ref once, at
// this component's own setup() time, which runs before the entry page's onMounted — see
// provideEditorLeftPanelExtraCategories' doc comment for why the caller must provide it
// synchronously, not from onMounted, for this to work.
const activeCategory = ref<RailKey | null>(
  editorLeftPanelExtraCategories.value[0]?.key ?? 'photo',
)

const activeExtraCategory = computed(() =>
  editorLeftPanelExtraCategories.value.find((category) => category.key === activeCategory.value),
)


// Only one side panel is open at a time — opening a rail flyout deselects the canvas and drops any
// pending page-properties request (see EditorPage.vue's store.showPropertiesPanel) so the two
// don't show together.
function toggleCategory(key: RailKey): void {
  const next = activeCategory.value === key ? null : key

  if (next !== null) {
    if (store.hasSelection) {
      store.clearSelection()
    }
    store.dismissPageProperties()
  }

  activeCategory.value = next
}

watch(activeCategory, (value) => emit('expanded', value !== null), { immediate: true })

// Defensive: if the active extra category disappears while its flyout is open (e.g. the entry
// page unmounts and clears the list), fall back rather than leave the rail pointed at a category
// with nothing to show. Only resets when the active category *was* one of the extras (checked
// against the previous list) — a built-in category (photo/text/shape/layers) is never in this
// list at all, so it must not be reset just because the extras changed.
watch(editorLeftPanelExtraCategories, (categories, previousCategories) => {
  const wasActiveExtra = previousCategories?.some((category) => category.key === activeCategory.value)
  const stillPresent = categories.some((category) => category.key === activeCategory.value)

  if (wasActiveExtra && !stillPresent) {
    activeCategory.value = null
  }
})

// The properties column is about to show (element selected, or page properties explicitly
// requested via a canvas background click) — close this panel so they don't overlap.
watch(
  () => store.showPropertiesPanel,
  (shouldShow) => {
    if (shouldShow) {
      activeCategory.value = null
    }
  },
)
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

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
  gap: $spacing-6;
  height: 100%;
  padding: $spacing-6 $spacing-2;
  border-right: 1px solid pp.$border-strong;
  background: #ededed;
  overflow-y: auto;
}

.editor-left-panel__rail-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-1;
  padding: 0;
  border: none;
  border-radius: pp.$radius;
  background: transparent;
  color: pp.$ink-soft;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    background: pp.$field-hover;
    color: pp.$ink;
  }

  &--active {
    color: pp.$accent-deep;
  }
}

.editor-left-panel__rail-icon-wrap {
  position: relative;
  display: inline-flex;
}

.editor-left-panel__rail-icon {
  width: 18px;
  height: 18px;
}

.editor-left-panel__badge {
  position: absolute;
  // Anchored to the icon itself (not the whole button) so it sits at the icon's corner
  // regardless of whether the label text below happens to be wider than the icon.
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

.editor-left-panel__flyout {
  position: relative;
  flex-shrink: 0;
  // Matches the properties column's width (EditorPage.vue) — the two panels are mutually
  // exclusive, so keeping them the same size avoids a visible width jump when switching.
  width: 320px;
  height: 100%;
  border-right: 1px solid $border-light;
  background: $white;
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
