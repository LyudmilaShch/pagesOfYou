import { inject } from 'vue'

import { useEditorStore } from '../store/editor.store'
import {
  ORDER_CANVAS_CONTEXT_KEY,
  type OrderCanvasContext,
} from '@/features/order-builder/canvas/order-canvas.types'

export function useElementCanvasStore(): OrderCanvasContext | ReturnType<typeof useEditorStore> {
  const orderCanvas = inject<OrderCanvasContext | null>(ORDER_CANVAS_CONTEXT_KEY, null)
  if (orderCanvas) {
    return orderCanvas
  }

  return useEditorStore()
}

export function useOrderCanvasStoreOrNull(): OrderCanvasContext | null {
  return inject<OrderCanvasContext | null>(ORDER_CANVAS_CONTEXT_KEY, null)
}
