import { ref } from 'vue'

/** Optional "pick from gallery" source for photo-placeholder editing — same injection pattern as
 * `editor-assets.ts`. Admin never sets this (stays `null`, only "Загрузить" shows); the
 * customer-facing journal editor provides it so "Выбрать из галереи" also appears next to it. */
export interface EditorPhotoPicker {
  /** Resolves with the picked photo's URL, or `null` if the user closed the picker without
   * choosing one. */
  open(): Promise<string | null>
}

export const editorPhotoPicker = ref<EditorPhotoPicker | null>(null)

export function provideEditorPhotoPicker(picker: EditorPhotoPicker | null): void {
  editorPhotoPicker.value = picker
}
