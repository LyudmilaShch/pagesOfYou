import { ref, type Component } from 'vue'

/** Optional extra rail categories in `EditorLeftPanel.vue`, alongside Фото/Текст/Фигуры/Слои —
 * same injection pattern as `editor-assets.ts`. Admin never sets this (stays `[]`, no extra rail
 * buttons); the customer-facing journal editor uses it for "Структура" and "Галерея". */
export interface EditorLeftPanelExtraCategory {
  /** Unique among the registered categories — used as the rail/flyout's `activeCategory` key. */
  key: string
  label: string
  /** MDI icon name (e.g. `'mdi-view-sequential'`). */
  icon: string
  panel: Component
}

export const editorLeftPanelExtraCategories = ref<EditorLeftPanelExtraCategory[]>([])

/** Call synchronously in the entry page's `<script setup>` body (not inside `onMounted`) — the
 * rail's default active category is decided at its own setup() time, which runs before the
 * parent's onMounted. Pass `[]` to clear (e.g. on unmount). */
export function provideEditorLeftPanelExtraCategories(
  categories: EditorLeftPanelExtraCategory[],
): void {
  editorLeftPanelExtraCategories.value = categories
}
