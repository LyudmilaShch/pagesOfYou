import { ref } from 'vue'

import {
  classifyUploadResolution,
  type PrintResolutionLevel,
} from '../utils/print-resolution.util'

/**
 * Upload grids know a file's pixel size either from the gallery record or, for older photos that
 * were stored without it, from the thumbnail's natural size once it has decoded.
 */
export function useUploadResolutionWarning() {
  const measured = ref<Record<string, { width: number; height: number }>>({})

  function onImageLoad(id: string, event: Event): void {
    const target = event.target

    if (!(target instanceof HTMLImageElement)) {
      return
    }

    if (target.naturalWidth <= 0 || target.naturalHeight <= 0) {
      return
    }

    const previous = measured.value[id]

    if (
      previous?.width === target.naturalWidth &&
      previous.height === target.naturalHeight
    ) {
      return
    }

    measured.value = {
      ...measured.value,
      [id]: { width: target.naturalWidth, height: target.naturalHeight },
    }
  }

  function uploadWarningLevel(photo: {
    id: string
    width: number | null
    height: number | null
  }): Exclude<PrintResolutionLevel, 'ok'> | null {
    const level =
      photo.width != null && photo.height != null
        ? classifyUploadResolution(photo.width, photo.height)
        : classifyUploadResolution(
            measured.value[photo.id]?.width,
            measured.value[photo.id]?.height,
          )

    return level === 'ok' ? null : level
  }

  return { onImageLoad, uploadWarningLevel }
}
