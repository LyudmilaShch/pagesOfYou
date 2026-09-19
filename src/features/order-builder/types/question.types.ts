export type QuestionType = 'TEXT' | 'TEXTAREA' | 'DATE' | 'IMAGE' | 'GALLERY' | 'SELECT'

export interface QuestionOption {
  id: string
  label: string
  value: string
  sortOrder: number
}

/** A questionnaire question, scoped to the magazine type as a whole (no page of its own — one
 * question may be referenced by elements on several pages) — the public/catalog-side view of the
 * admin's `Question` (no magazineTypeId/timestamps/deletedAt). */
export interface Question {
  id: string
  key: string
  type: QuestionType
  label: string
  helpText: string | null
  placeholder: string | null
  isRequired: boolean
  sortOrder: number
  options: QuestionOption[]
}
