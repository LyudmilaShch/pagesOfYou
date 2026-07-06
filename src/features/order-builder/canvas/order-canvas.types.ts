import type { PageElement } from '@/modules/editor/models'
import type { Position } from '@/modules/editor/models/geometry.model'
import type { ElementPatch } from '@/modules/editor/store/editor.store'
import type { SmartGuideLines } from '@/modules/editor/utils/smart-guides.util'

export const ORDER_CANVAS_CONTEXT_KEY = Symbol('orderCanvasContext')

export interface OrderCanvasContext {
  previewMode: boolean
  canvasZoom: number
  snapToGridEnabled: boolean
  snapGridSize: number
  smartGuidesEnabled: boolean
  smartGuideLines: SmartGuideLines
  printSafeZoneEnabled: boolean
  printCropZoneViolation: boolean
  textEditingElementId: string | null
  photoCropEditingElementId: string | null
  photoDimElementId: string | null
  photoDropTargetId: string | null
  liveDragPositions: Record<string, Position>
  pageWidth: number
  pageHeight: number
  backgroundColor: string
  elements: PageElement[]
  selectedElementIds: string[]
  selectedElement: PageElement | null
  alignableSelectedElements: PageElement[]
  isMultiSelection: boolean
  isSpreadPage: boolean

  isElementSelected(id: string): boolean
  selectElement(id: string): void
  toggleElementSelection(id: string): void
  startTextEditing(id: string): void
  stopTextEditing(): void
  startPhotoDim(id: string): void
  stopPhotoDim(): void
  startPhotoCropEditing(id: string): void
  stopPhotoCropEditing(): void
  setPhotoDropTarget(id: string | null): void
  setPhotoImage(elementId: string, url: string): void
  updatePhotoCrop(
    elementId: string,
    patch: Partial<{ cropX: number; cropY: number; imageScale: number }>,
    options?: { live?: boolean },
  ): void
  resetPhotoCropOnResize(elementId: string, options?: { live?: boolean }): void
  registerPhotoImageDimensions(elementId: string, size: { width: number; height: number }): void
  updateElement(id: string, patch: ElementPatch, options?: { live?: boolean }): void
  recalculateTextElementSize(
    id: string,
    displayText?: string | null,
    options?: { adjustAnchor?: boolean },
  ): void
  moveElementsPositions(patches: Array<{ id: string; position: Position }>): void
  setLiveDragPosition(id: string, position: Position): void
  setLiveDragPositions(positions: Record<string, Position>): void
  clearLiveDragPosition(id: string): void
  clearLiveDragPositions(ids?: string[]): void
  finalizeLiveTransform(): void
  setSmartGuideLines(lines: SmartGuideLines): void
  clearSmartGuideLines(): void
  snapCoordinate(value: number): number
  zoomPhotoReposition(scaleDelta: number, focalPagePoint?: { x: number; y: number }): void
  toggleSnapToGrid(): void
  toggleSmartGuides(): void
  togglePrintSafeZone(): void
  zoomIn(): void
  zoomOut(): void
  resetCanvasZoom(): void
  clearSelection(): void
  getTextValue(elementId: string): string
  updateText(elementId: string, value: string): void
  promptPhotoUpload(elementId: string): void
}
