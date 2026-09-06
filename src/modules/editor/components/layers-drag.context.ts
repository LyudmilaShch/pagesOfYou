import type { InjectionKey, Ref } from 'vue'

export type LayersDropZone = 'before' | 'after' | 'inside'

export interface LayersDragOverInfo {
  id: string
  zone: LayersDropZone
}

export interface LayersDragContext {
  draggedId: Ref<string | null>
  dragOverInfo: Ref<LayersDragOverInfo | null>
  startDrag: (id: string) => void
  // MouseEvent (not DragEvent) so the same function serves both native drag-and-drop (mouse, see
  // EditorLayerNode.vue's dragover) and the touch/pen pointer-based drag (PointerEvent also
  // extends MouseEvent) — only .clientY is ever read.
  overRow: (id: string, isGroup: boolean, event: MouseEvent, rowEl: HTMLElement | null) => void
  leaveRow: (id: string) => void
  dropOnRow: (id: string) => void
  endDrag: () => void
}

export const LAYERS_DRAG_CONTEXT_KEY: InjectionKey<LayersDragContext> = Symbol('layers-drag-context')
