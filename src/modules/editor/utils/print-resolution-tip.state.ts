import { ref } from 'vue'

/** One canvas-level tooltip. Konva nodes can't host a Vuetify tooltip, and the badge itself
 * lives inside the stage, so the DOM tip is rendered by EditorCanvas. */
export const printResolutionTip = ref<{
  x: number
  y: number
  message: string
} | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer(): void {
  if (hideTimer != null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

export function showPrintResolutionTip(
  x: number,
  y: number,
  message: string,
  autoHide = false,
): void {
  printResolutionTip.value = { x, y, message }
  clearHideTimer()

  if (autoHide) {
    hideTimer = setTimeout(() => {
      printResolutionTip.value = null
      hideTimer = null
    }, 2500)
  }
}

export function hidePrintResolutionTip(): void {
  clearHideTimer()
  printResolutionTip.value = null
}
