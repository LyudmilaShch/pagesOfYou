import { ref } from 'vue'

import type { QuestionOptionPayload, QuestionType } from '@/shared/api/admin/questions.api'

/** One question available for binding to a canvas element's `questionKey`(s), scoped to the
 * magazine type currently open in the template editor — same injection pattern as
 * `editor-assets.ts`. Admin (template-build) mode provides this; the customer-facing journal
 * editor never does (stays `[]`, so the "Вопрос анкеты" picker and AI-text config screen don't
 * appear there — binding questions to elements is a template-authoring concern only). */
export interface EditorQuestionRef {
  key: string
  label: string
}

export interface CreateEditorQuestionPayload {
  key: string
  label: string
  type: QuestionType
  placeholder?: string
  helpText?: string
  isRequired?: boolean
  options?: QuestionOptionPayload[]
}

export const editorQuestions = ref<EditorQuestionRef[]>([])

/** Non-null only in admin (template-build) mode — lets the question-picker dialog show its
 * "add question" form there, and distinguishes "feature enabled, zero questions yet" from
 * "feature unavailable" (the customer-facing editor provides neither this nor `editorQuestions`,
 * so the whole question-picker UI stays hidden there regardless of question count). */
export const createEditorQuestion = ref<((payload: CreateEditorQuestionPayload) => Promise<EditorQuestionRef>) | null>(
  null,
)

export function provideEditorQuestions(
  questions: EditorQuestionRef[],
  createFn: ((payload: CreateEditorQuestionPayload) => Promise<EditorQuestionRef>) | null = null,
): void {
  editorQuestions.value = questions
  createEditorQuestion.value = createFn
}
