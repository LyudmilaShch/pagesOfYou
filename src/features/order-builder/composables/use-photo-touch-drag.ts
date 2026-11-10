import { onBeforeUnmount, onMounted, ref } from 'vue'

import { readPhotoDropTarget } from '../utils/photo-touch-drag.util'

export interface PhotoTouchDrag {
  url: string
  x: number
  y: number
}

/** Touch drag of a gallery thumb onto a book photo slot. Mouse drags stay on the native HTML5
 * path (`draggable` / `dragstart`). A finger on the thumb starts immediately — the thumb itself
 * uses `touch-action: none`, otherwise the browser scrolls the row and cancels the pointer. */
export function usePhotoTouchDrag(
  onDrop: (target: { pageId: string; elementId: string }, url: string) => void,
) {
  const drag = ref<PhotoTouchDrag | null>(null)
  let mobileQuery: MediaQueryList | null = null
  let mobile = false

  function syncMobile(): void {
    mobile = mobileQuery?.matches ?? false
  }

  function stop(): void {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }

  function onMove(event: PointerEvent): void {
    if (!drag.value) {
      return
    }
    event.preventDefault()
    drag.value = { ...drag.value, x: event.clientX, y: event.clientY }
  }

  function onUp(event: PointerEvent): void {
    stop()
    const current = drag.value
    drag.value = null
    if (!current) {
      return
    }
    const target = readPhotoDropTarget(document.elementFromPoint(event.clientX, event.clientY))
    if (target) {
      onDrop(target, current.url)
    }
  }

  function onCancel(): void {
    stop()
    drag.value = null
  }

  function onPointerDown(event: PointerEvent, url: string): void {
    if (event.pointerType === 'mouse' || !mobile) {
      return
    }
    event.preventDefault()
    drag.value = { url, x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  onMounted(() => {
    mobileQuery = window.matchMedia('(max-width: 767px)')
    syncMobile()
    mobileQuery.addEventListener('change', syncMobile)
  })

  onBeforeUnmount(() => {
    mobileQuery?.removeEventListener('change', syncMobile)
    stop()
  })

  return { drag, onPointerDown }
}
