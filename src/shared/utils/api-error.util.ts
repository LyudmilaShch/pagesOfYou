import { getMaxImageUploadSizeErrorMessage } from '@/shared/constants/upload.constants'

const API_ERROR_MESSAGES_RU: Record<string, string> = {
  'File too large': getMaxImageUploadSizeErrorMessage(),
  'File too small': 'Файл слишком маленький или повреждён.',
  'Unexpected field': 'Неверный формат запроса загрузки.',
}

function readApiErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return ''
  }

  const error = err as {
    response?: { data?: { message?: string | string[] } }
    message?: string
  }

  const dataMessage = error.response?.data?.message

  if (Array.isArray(dataMessage)) {
    return dataMessage.filter(Boolean).join(', ')
  }

  if (typeof dataMessage === 'string' && dataMessage.trim()) {
    return dataMessage.trim()
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return ''
}

export function extractApiErrorMessage(
  err: unknown,
  fallback = 'Что-то пошло не так. Попробуйте ещё раз.',
): string {
  const raw = readApiErrorMessage(err)

  if (!raw) {
    return fallback
  }

  return API_ERROR_MESSAGES_RU[raw] ?? raw
}

export function getUploadErrorMessage(err: unknown): string {
  return extractApiErrorMessage(err, 'Не удалось загрузить изображение. Попробуйте ещё раз.')
}
