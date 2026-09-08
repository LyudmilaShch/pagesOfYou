import { ref } from 'vue'

/** Optional override for the editor layout's primary top-bar action — same injection pattern as
 * `editor-assets.ts`/`editor-left-panel-extra-category.ts`. Admin never sets this (stays `null`,
 * the button stays a plain "Сохранить"); the customer-facing journal editor uses it to turn that
 * button into "Оформить заказ". `isLoading`/`isDisabled` are getters (not refs) so they can be
 * read fresh in the template on every render without needing to unwrap nested refs. */
export interface EditorTopAction {
  label: string
  icon?: string
  isLoading: () => boolean
  isDisabled: () => boolean
  onClick: () => void | Promise<void>
}

export const editorTopAction = ref<EditorTopAction | null>(null)

/** Call synchronously in the entry page's `<script setup>` body (not inside `onMounted`), same
 * timing requirement as `provideEditorLeftPanelExtraCategory`. Pass `null` to clear (e.g. on
 * unmount) so a later admin visit in the same tab doesn't inherit it. */
export function provideEditorTopAction(action: EditorTopAction | null): void {
  editorTopAction.value = action
}
