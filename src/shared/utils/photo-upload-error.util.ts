import {
  fileTooLargeMessage,
  unsupportedPhotoFormatMessage,
  validatePhotoFile,
} from '@/shared/constants/photo-upload.constants'
import { getMaxImageUploadSizeErrorMessage } from '@/shared/constants/upload.constants'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'

/** HEIC decode on a phone photo can outlast the default 15s API timeout. */
export const PHOTO_UPLOAD_TIMEOUT_MS = 120_000

/**
 * Server (multer, HEIC conversion) or client rejection, always naming the file.
 * If the server already returned «Файл «name» …», that sentence is kept.
 */
export function formatPhotoUploadFailure(fileName: string, err: unknown): string {
  const message = getUploadErrorMessage(err)
  if (message.includes(`«${fileName}»`)) {
    return message
  }
  if (
    message === 'File too large' ||
    message === getMaxImageUploadSizeErrorMessage() ||
    message.startsWith('Файл слишком большой')
  ) {
    return fileTooLargeMessage(fileName)
  }
  if (
    message === 'Unsupported file type' ||
    message.startsWith('Неподдерживаемый формат') ||
    message === 'Формат не поддерживается'
  ) {
    return unsupportedPhotoFormatMessage(fileName)
  }
  return `Файл «${fileName}»: ${message}`
}

/** Validates each file, uploads the rest, and returns one Russian sentence per rejection. */
export async function runPhotoUploads(
  files: File[],
  uploadOne: (file: File) => Promise<void>,
): Promise<string[]> {
  const errors: string[] = []
  for (const file of files) {
    const problem = validatePhotoFile(file)
    if (problem) {
      errors.push(problem)
      continue
    }
    try {
      await uploadOne(file)
    } catch (err: unknown) {
      errors.push(formatPhotoUploadFailure(file.name, err))
    }
  }
  return errors
}
