import { adminHttp } from '@/features/admin/api/admin-http'
import type { BackendResponse } from '@/types/api.types'

export type QuestionType = 'TEXT' | 'TEXTAREA' | 'DATE' | 'IMAGE' | 'GALLERY' | 'SELECT'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  TEXT: 'Короткий текст',
  TEXTAREA: 'Текст (многострочный)',
  DATE: 'Дата',
  IMAGE: 'Фотография',
  GALLERY: 'Галерея фотографий',
  SELECT: 'Выбор из списка',
}

export interface AdminQuestionOption {
  id: string
  label: string
  value: string
  sortOrder: number
}

export interface AdminQuestion {
  id: string
  magazineTypeId: string
  key: string
  type: QuestionType
  label: string
  helpText: string | null
  placeholder: string | null
  isRequired: boolean
  sortOrder: number
  validationRules: Record<string, unknown> | null
  options: AdminQuestionOption[]
  createdAt: string
  updatedAt: string
}

export interface QuestionOptionPayload {
  label: string
  value: string
  sortOrder?: number
}

export interface CreateQuestionPayload {
  key: string
  type: QuestionType
  label: string
  helpText?: string
  placeholder?: string
  isRequired?: boolean
  validationRules?: Record<string, unknown>
  options?: QuestionOptionPayload[]
}

export type UpdateQuestionPayload = Partial<CreateQuestionPayload>

export interface ReorderQuestionsPayload {
  items: Array<{ id: string; sortOrder: number }>
}

export const adminQuestionsApi = {
  async list(magazineTypeId: string): Promise<AdminQuestion[]> {
    const { data } = await adminHttp.get<BackendResponse<AdminQuestion[]>>(
      `/admin/magazine-types/${magazineTypeId}/questions`,
    )
    return data.data
  },

  async getOne(magazineTypeId: string, questionId: string): Promise<AdminQuestion> {
    const { data } = await adminHttp.get<BackendResponse<AdminQuestion>>(
      `/admin/magazine-types/${magazineTypeId}/questions/${questionId}`,
    )
    return data.data
  },

  async create(magazineTypeId: string, payload: CreateQuestionPayload): Promise<AdminQuestion> {
    const { data } = await adminHttp.post<BackendResponse<AdminQuestion>>(
      `/admin/magazine-types/${magazineTypeId}/questions`,
      payload,
    )
    return data.data
  },

  async update(
    magazineTypeId: string,
    questionId: string,
    payload: UpdateQuestionPayload,
  ): Promise<AdminQuestion> {
    const { data } = await adminHttp.patch<BackendResponse<AdminQuestion>>(
      `/admin/magazine-types/${magazineTypeId}/questions/${questionId}`,
      payload,
    )
    return data.data
  },

  async reorder(magazineTypeId: string, payload: ReorderQuestionsPayload): Promise<AdminQuestion[]> {
    const { data } = await adminHttp.patch<BackendResponse<AdminQuestion[]>>(
      `/admin/magazine-types/${magazineTypeId}/questions/reorder`,
      payload,
    )
    return data.data
  },

  async remove(magazineTypeId: string, questionId: string): Promise<void> {
    await adminHttp.delete(`/admin/magazine-types/${magazineTypeId}/questions/${questionId}`)
  },
}
