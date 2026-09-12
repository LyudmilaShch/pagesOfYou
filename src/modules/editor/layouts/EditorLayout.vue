<template>
  <div class="editor-layout">
    <header class="editor-layout__header">
      <div class="editor-layout__header-left">
        <button
          v-if="backUseHistory"
          type="button"
          class="editor-layout__back"
          @click="router.back()"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          <span class="editor-layout__back-label">{{ backLabel }}</span>
        </button>
        <router-link v-else :to="resolvedBackTo" class="editor-layout__back">
          <v-icon size="18">mdi-arrow-left</v-icon>
          <span class="editor-layout__back-label">{{ backLabel }}</span>
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
          :prepend-icon="topAction ? (topAction.icon ?? 'mdi-cart-outline') : 'mdi-content-save-outline'"
          class="editor-layout__desktop-only"
          :loading="topAction ? topAction.isLoading() : store.saving"
          :disabled="topAction ? topAction.isDisabled() : (!store.document || !store.isDirty || store.previewMode)"
          @click="handleTopAction"
        >
          {{ topAction ? topAction.label : 'Сохранить' }}
        </v-btn>

        <v-tooltip location="bottom" content-class="editor-tooltip--arrow-bottom">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon
              size="small"
              variant="text"
              class="editor-layout__mobile-save"
              :loading="topAction ? topAction.isLoading() : store.saving"
              :disabled="topAction ? topAction.isDisabled() : (!store.document || !store.isDirty || store.previewMode)"
              :aria-label="topAction ? topAction.label : 'Сохранить'"
              @click="handleTopAction"
            >
              <v-icon size="20">{{ topAction ? (topAction.icon ?? 'mdi-cart-outline') : 'mdi-content-save-outline' }}</v-icon>
            </v-btn>
          </template>
          {{ topAction ? topAction.label : 'Сохранить' }}
        </v-tooltip>
      </div>
    </header>

    <main class="editor-layout__main">
      <!-- No :key here on purpose: the order builder's "Структура" panel switches :journalPageId
           within this same route, and forcing a remount on that would tear down and rebuild the
           whole EditorPage tree (including the rail/flyout panels) on every page switch — visibly
           flashing them away. JournalPageEditorPage.vue instead watches the param and reloads the
           document in place, keeping the rail mounted throughout. -->
      <router-view />
    </main>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import { useEditorStore } from '../store/editor.store'
import { editorTopAction } from '../services/editor-top-action'

const props = withDefaults(
  defineProps<{
    /** Defaults to the admin "back to template pages" destination when omitted. */
    backTo?: RouteLocationRaw
    backLabel?: string
    savedMessage?: string
    saveErrorMessage?: string
    /** When true, ignores `backTo` and just navigates back in browser history — used where
     * there's no single fixed "parent" page (the customer editor can be entered from order
     * creation, the account page's drafts list, etc). */
    backUseHistory?: boolean
  }>(),
  {
    backTo: undefined,
    backLabel: 'Страницы',
    savedMessage: 'Шаблон сохранён',
    saveErrorMessage: 'Не удалось сохранить шаблон',
    backUseHistory: false,
  },
)

const route = useRoute()
const router = useRouter()
const store = useEditorStore()
const topAction = editorTopAction

const magazineTypeId = computed(() => route.params.magazineTypeId as string)
const resolvedBackTo = computed<RouteLocationRaw>(
  () =>
    props.backTo ?? {
      name: 'admin-magazine-type-edit',
      params: { id: magazineTypeId.value },
      query: { tab: 'pages' },
    },
)

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
    snackbar.text = props.savedMessage
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = props.saveErrorMessage
    snackbar.color = 'error'
    snackbar.show = true
  }
}

/** The top-bar button's click handler — delegates to whatever `provideEditorTopAction` registered
 * (e.g. "Оформить заказ" in the order builder), which owns its own feedback (its own snackbar,
 * navigation, etc.); falls back to the plain save otherwise. Deliberately not wired to Ctrl+S —
 * that stays a plain save everywhere, so the shortcut can never accidentally submit an order. */
async function handleTopAction(): Promise<void> {
  if (topAction.value) {
    await topAction.value.onClick()
    return
  }

  await handleSave()
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
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
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
    // 100vh on mobile is the "largest possible" viewport (address bar hidden) — with the URL bar
    // actually showing, the real visible area is shorter, so a plain 100vh here pushes the bottom
    // of the layout (docks, pagination dots) below the fold with no way to scroll to it (overflow
    // is hidden below). 100dvh tracks the real, currently-visible viewport instead; the 100vh line
    // stays first as a fallback for browsers that don't understand dvh (they just ignore the rule
    // that follows and keep this one).
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    // Without this, a touch that overscrolls past an inner overflow:hidden boundary (e.g. the
    // canvas pan hitting its limit) chains the leftover scroll delta up to <body>/<html> — which
    // still has normal page scrolling for the rest of the app — showing up as the whole page
    // bouncing/scrolling underneath the editor. Containing it here stops that chain.
    overscroll-behavior: none;
  }

  .editor-layout__main {
    overflow: hidden;
    overscroll-behavior: none;
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
