import { ref } from 'vue'

export type PlaceholderSource = 'AUTO' | 'AI' | 'OVERRIDDEN'

/** Customer-only sync-state affordances (source indicator, "revert to answer", AI regenerate) —
 * same injection pattern as `editor-questions.ts`. Admin contexts (template editor, admin viewing
 * a customer's order) never set this, so `EditorPropertiesPanel.vue` gates all of Phase 5's UI on
 * it being non-null instead of reusing `editorQuestions` (whose "empty" state doesn't uniquely
 * mean "customer" — the admin-order-view route also leaves it empty). */
export interface EditorPlaceholderSync {
  /** Snapshot taken when the page loaded (from the last `GET /orders/:id`) — not live-tracked,
   * see the Этап 5 plan's "Контекст" for why: the editor's real autosave (`saveJournalPageCanvas`)
   * wipes `PlaceholderValue` rows on every save, so there's nowhere for a persistent per-element
   * state to live without a much bigger rearchitecture. */
  sourceByElementId: Map<string, PlaceholderSource>
  /** Pulls the current questionnaire answer for this element's questionKey into the canvas
   * element (defaultText/defaultImageUrl) — a plain client-side patch that rides the next normal
   * autosave, not a persistent link. Returns false when there's nothing to pull (no questionKey
   * bound, or no answer yet). */
  revertToAnswer(elementId: string): boolean
  /** Real network call — regenerates one ai-text-placeholder element via YandexGPT and applies
   * the result to the live canvas element. Throws on failure (not best-effort). */
  regenerateAiText(elementId: string): Promise<string>
}

export const editorPlaceholderSync = ref<EditorPlaceholderSync | null>(null)

export function provideEditorPlaceholderSync(value: EditorPlaceholderSync | null): void {
  editorPlaceholderSync.value = value
}
