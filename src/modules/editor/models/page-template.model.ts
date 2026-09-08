import type { CanvasData } from './canvas-data.model'
import type { PageBackgroundImageFit, PageBackgroundSettings, SpreadBackgroundMode } from './page-background.model'

/** Minimal shape a caller hands to the editor store to load a page — decouples the store from
 * any specific backend (admin magazine pages, a user's journal page, ...). */
export interface EditorSourceDocument {
  id: string
  name: string
  pageType: string
  canvasData: CanvasData
}

/** Runtime document loaded into the page editor. */
export interface EditorDocument {
  id: string
  name: string
  pageType: string
  width: number
  height: number
  backgroundColor: string
  backgroundImageUrl: string | null
  backgroundImageFit: PageBackgroundImageFit
  backgroundImageCropX: number
  backgroundImageCropY: number
  backgroundImageScale: number
  spreadBackgroundMode: SpreadBackgroundMode
  leftPageBackground: PageBackgroundSettings
  rightPageBackground: PageBackgroundSettings
  canvasData: CanvasData
}