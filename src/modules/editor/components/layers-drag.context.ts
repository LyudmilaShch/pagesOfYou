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
  overRow: (id: string, isGroup: boolean, event: DragEvent, rowEl: HTMLElement | null) => void
  leaveRow: (id: string) => void
  dropOnRow: (id: string) => void
  endDrag: () => void
}

export const LAYERS_DRAG_CONTEXT_KEY: InjectionKey<LayersDragContext> = Symbol('layers-drag-context')
