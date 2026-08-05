export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export const MAX_IMAGE_UPLOAD_SIZE_MB = MAX_IMAGE_UPLOAD_SIZE_BYTES / (1024 * 1024)

export function formatMaxImageUploadSizeLabel(): string {
  return `${MAX_IMAGE_UPLOAD_SIZE_MB} МБ`
}

export function getMaxImageUploadSizeErrorMessage(): string {
  return `Файл слишком большой. Максимальный размер — ${formatMaxImageUploadSizeLabel()}.`
}

export const MAX_FONT_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export const MAX_FONT_UPLOAD_SIZE_MB = MAX_FONT_UPLOAD_SIZE_BYTES / (1024 * 1024)

export function formatMaxFontUploadSizeLabel(): string {
  return `${MAX_FONT_UPLOAD_SIZE_MB} МБ`
}

export function getMaxFontUploadSizeErrorMessage(): string {
  return `Файл слишком большой. Максимальный размер — ${formatMaxFontUploadSizeLabel()}.`
}
