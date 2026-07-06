import type { CanvasData } from './canvas-data.model'

/** Runtime document loaded into the page editor. */
export interface EditorDocument {
  magazineTypeId: string
  magazinePageId: string
  name: string
  pageType: string
  width: number
  height: number
  backgroundColor: string
  canvasData: CanvasData
}
