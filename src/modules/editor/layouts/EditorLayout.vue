<template>
  <div class="editor-layout">
    <header class="editor-layout__header">
      <div class="editor-layout__header-left">
        <router-link
          :to="{
            name: 'admin-magazine-type-edit',
            params: { id: magazineTypeId },
            query: { tab: 'pages' },
          }"
          class="editor-layout__back"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          <span class="editor-layout__back-label">Страницы</span>
        </router-link>

        <div class="editor-layout__divider editor-layout__desktop-only" aria-hidden="true" />

        <div class="editor-layout__brand editor-layout__desktop-only">
          <span class="editor-layout__brand-name">Фолио</span>
          <span class="editor-layout__brand-badge">Editor</span>
        </div>
      </div>

      <div class="editor-layout__header-center">
        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              :disabled="!store.canUndo || store.previewMode"
              aria-label="Отменить (Ctrl+Z)"
              @click="store.undo()"
            >
              <v-icon size="20">mdi-undo</v-icon>
            </v-btn>
          </template>
          Отменить (Ctrl+Z)
        </v-tooltip>
        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              :disabled="!store.canRedo || store.previewMode"
              aria-label="Повторить (Ctrl+Shift+Z)"
              @click="store.redo()"
            >
              <v-icon size="20">mdi-redo</v-icon>
            </v-btn>
          </template>
          Повторить (Ctrl+Shift+Z)
        </v-tooltip>

        <div class="editor-layout__divider editor-layout__group-tools" aria-hidden="true" />

        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              class="editor-layout__group-tools"
              :disabled="!store.hasSelection || store.previewMode"
              aria-label="Дублировать (Ctrl+D)"
              @click="store.duplicateElement()"
            >
              <v-icon size="20">mdi-content-copy</v-icon>
            </v-btn>
          </template>
          Дублировать (Ctrl+D)
        </v-tooltip>

        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              class="editor-layout__group-tools"
              :disabled="store.selectionCount < 2 || store.previewMode"
              aria-label="Сгруппировать (Ctrl+G)"
              @click="store.groupSelection()"
            >
              <v-icon size="20">mdi-group</v-icon>
            </v-btn>
          </template>
          Сгруппировать (Ctrl+G)
        </v-tooltip>

        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              class="editor-layout__group-tools"
              :disabled="!canUngroupSelection || store.previewMode"
              aria-label="Разгруппировать (Ctrl+Shift+G)"
              @click="ungroupSelection()"
            >
              <v-icon size="20">mdi-ungroup</v-icon>
            </v-btn>
          </template>
          Разгруппировать (Ctrl+Shift+G)
        </v-tooltip>

        <v-btn
          size="small"
          :variant="store.previewMode ? 'flat' : 'text'"
          :color="store.previewMode ? 'primary' : undefined"
          :prepend-icon="store.previewMode ? 'mdi-pencil-outline' : 'mdi-eye-outline'"
          @click="store.togglePreviewMode()"
        >
          {{ store.previewMode ? 'Редактирование' : 'Превью' }}
        </v-btn>
      </div>

      <div class="editor-layout__header-right">
        <span class="editor-layout__template-name editor-layout__desktop-only">{{ store.templateName }}</span>
        <v-chip
          v-if="store.isSpreadPage"
          class="editor-layout__desktop-only"
          size="x-small"
          variant="tonal"
          color="primary"
          label
        >
          Разворот 2×A4
        </v-chip>
        <span v-if="store.document" class="editor-layout__page-size editor-layout__desktop-only">
          {{ store.document.width }}×{{ store.document.height }}
        </span>
        <v-chip v-if="store.isDirty" class="editor-layout__desktop-only" size="x-small" variant="tonal" color="warning" label>
          Не сохранено
        </v-chip>
        <v-btn
          color="primary"
          size="small"
          prepend-icon="mdi-content-save-outline"
          class="editor-layout__desktop-only"
          :loading="store.saving"
          :disabled="!store.document || !store.isDirty || store.previewMode"
          @click="handleSave"
        >
          Сохранить
        </v-btn>

        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              class="editor-layout__mobile-save"
              :loading="store.saving"
              :disabled="!store.document || !store.isDirty || store.previewMode"
              aria-label="Сохранить"
              @click="handleSave"
            >
              <v-icon size="20">mdi-content-save-outline</v-icon>
            </v-btn>
          </template>
          Сохранить
        </v-tooltip>
      </div>
    </header>

    <main class="editor-layout__main">
      <router-view />
    </main>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute } from 'vue-router'

import { useEditorStore } from '../store/editor.store'

const route = useRoute()
const store = useEditorStore()

const magazineTypeId = computed(() => route.params.magazineTypeId as string)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

function handleKeyDown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return
  }

  // `event.code` reflects the PHYSICAL key regardless of the active input language (e.g. on a
  // Cyrillic ЙЦУКЕН layout, `event.key` for the physical G key is "п", not "g") — `event.key` is
  // fine for named keys (Escape/Delete/Backspace, unaffected by layout) but letter shortcuts must
  // key off `code` to work under any keyboard layout.
  const code = event.code
  const withCtrl = event.ctrlKey || event.metaKey

  if (withCtrl && code === 'KeyS') {
    event.preventDefault()
    if (!store.previewMode && store.isDirty) {
      void handleSave()
    }
    return
  }

  if (withCtrl && code === 'KeyZ' && !event.shiftKey) {
    event.preventDefault()
    store.undo()
    return
  }

  if (withCtrl && (code === 'KeyY' || (code === 'KeyZ' && event.shiftKey))) {
    event.preventDefault()
    store.redo()
    return
  }

  if (withCtrl && code === 'KeyD') {
    event.preventDefault()
    if (!store.previewMode) {
      store.duplicateElement()
    }
    return
  }

  if (withCtrl && code === 'KeyC') {
    event.preventDefault()
    if (!store.previewMode && store.hasSelection) {
      store.copySelection()
    }
    return
  }

  if (withCtrl && code === 'KeyV') {
    event.preventDefault()
    if (!store.previewMode && store.hasClipboardContent) {
      store.pasteClipboard()
    }
    return
  }

  if (withCtrl && code === 'KeyG' && event.shiftKey) {
    event.preventDefault()
    if (!store.previewMode) {
      ungroupSelection()
    }
    return
  }

  if (withCtrl && code === 'KeyG') {
    event.preventDefault()
    if (!store.previewMode) {
      store.groupSelection()
    }
    return
  }

  if (event.key === 'Escape') {
    if (store.previewMode) {
      store.setPreviewMode(false)
    } else {
      store.selectElement(null)
    }
    return
  }

  if (store.previewMode) {
    return
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && store.hasSelection) {
    const impactCount = store.getRemovalImpactCount(store.selectedElementIds)
    if (impactCount > 0 && !window.confirm(`Удалить группу и ${impactCount} вложенных объектов?`)) {
      return
    }
    store.removeSelectedElements()
  }
}

const canUngroupSelection = computed(
  () => store.selectionCount === 1 && store.selectedElement?.type === 'group',
)

function ungroupSelection(): void {
  if (!canUngroupSelection.value || !store.selectedElement) {
    return
  }

  store.ungroupElement(store.selectedElement.id)
}

async function handleSave(): Promise<void> {
  try {
    await store.saveCanvas()
    snackbar.text = 'Шаблон сохранён'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = 'Не удалось сохранить шаблон'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped lang="scss">
.editor-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $bg-primary;
}

.editor-layout__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: $spacing-4;
  min-height: 64px;
  padding: 0 $spacing-4;
  border-bottom: 1px solid $border-light;
  background: $bg-elevated;
}

.editor-layout__header-left,
.editor-layout__header-center,
.editor-layout__header-right {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.editor-layout__header-center {
  justify-content: center;
}

.editor-layout__header-right {
  justify-content: flex-end;
}

.editor-layout__back {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  color: $text-secondary;
  text-decoration: none;
  font-size: $font-size-body-sm;
  transition: color 0.18s ease;

  &:hover {
    color: $text-primary;
  }
}

.editor-layout__divider {
  width: 1px;
  height: 24px;
  background: $border-light;
}

.editor-layout__brand {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.editor-layout__brand-name {
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.editor-layout__brand-badge {
  padding: 2px $spacing-2;
  border-radius: $radius-sm;
  background: $bg-inverse;
  color: $text-inverse;
  font-size: $font-size-caption;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
}

.editor-layout__template-name {
  font-size: $font-size-body-sm;
  color: $text-primary;
}

.editor-layout__page-size {
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-layout__main {
  flex: 1;
  min-height: 0;
}

// Mobile-only icon save button, positioned in the top brand row — hidden on desktop, where the
// original labelled button in .editor-layout__header-right is used instead.
.editor-layout__mobile-save {
  display: none;
}

@include mobile-only {
  // The editor is a fixed-viewport app screen on mobile, not a scrollable document — the header
  // is a fixed height and .editor-page__canvas/.mobile-dock fill exactly what's left (see
  // EditorPage.vue), so nothing here should ever need to grow past 100vh. Locking both the exact
  // height and overflow is a safety net in case something inside briefly overflows anyway.
  .editor-layout {
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  }

  .editor-layout__main {
    overflow: hidden;
  }

  // Single compact row: back arrow — undo/redo — preview — save, everything else that doesn't
  // fit that sequence (brand, spread/size info, dirty chip, labelled save) is dropped.
  .editor-layout__header {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    min-height: auto;
    padding: $spacing-2 $spacing-3;
  }

  .editor-layout__header-right {
    margin-left: auto;
  }

  .editor-layout__mobile-save {
    display: inline-flex;
  }

  .editor-layout__back-label,
  .editor-layout__group-tools,
  .editor-layout__desktop-only {
    display: none;
  }
}
</style>
