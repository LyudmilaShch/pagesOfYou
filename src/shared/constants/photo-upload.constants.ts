import {
  formatMaxImageUploadSizeLabel,
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
} from '@/shared/constants/upload.constants'

/**
 * Must stay in sync with `isAllowedOrderPhoto` on the backend
 * (`backend/src/modules/files/prepare-order-photo.ts`).
 * JPG and JPEG are both extensions of image/jpeg. WebP is stored as-is.
 * HEIC and HEIF are iPhone photos: the server converts them to a high-quality JPEG
 * before storage, so Chrome, Konva and the print PDF can show them.
 */
export const PHOTO_UPLOAD_FORMATS_LABEL = 'JPG, JPEG, PNG, WebP, HEIC, HEIF'

/**
 * `image/*` keeps the iOS photo library from hiding HEIC. The extensions are what make
 * desktop Chrome offer .heic/.heif — `image/*` alone does not. Files outside the label
 * are still rejected by `validatePhotoFile`.
 */
export const PHOTO_FILE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif'

const PHOTO_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
])

const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

export function getPhotoUploadHint(): string {
  return `Поддерживаемые форматы: ${PHOTO_UPLOAD_FORMATS_LABEL}. До ${formatMaxImageUploadSizeLabel()}. Загружайте фото в максимальном качестве.`
}

export function fileTooLargeMessage(fileName: string): string {
  return `Файл «${fileName}» больше ${formatMaxImageUploadSizeLabel()}`
}

export function unsupportedPhotoFormatMessage(fileName: string): string {
  return `Файл «${fileName}»: формат не поддерживается`
}

function photoFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) {
    return ''
  }
  return name.slice(dot).toLowerCase()
}

export function isSupportedPhotoFile(file: {
  name: string
  type: string
}): boolean {
  const mime = file.type.toLowerCase()
  if (PHOTO_MIME_TYPES.has(mime)) {
    return true
  }
  const extension = photoFileExtension(file.name)
  if (!PHOTO_EXTENSIONS.has(extension)) {
    return false
  }
  return mime === '' || mime === 'application/octet-stream'
}

/** `null` when the file can be uploaded. The message names the file and the reason. */
export function validatePhotoFile(file: {
  name: string
  type: string
  size: number
}): string | null {
  if (!isSupportedPhotoFile(file)) {
    return unsupportedPhotoFormatMessage(file.name)
  }
  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return fileTooLargeMessage(file.name)
  }
  return null
}
