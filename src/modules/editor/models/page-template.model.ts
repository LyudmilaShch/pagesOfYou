import type { CanvasData } from './canvas-data.model'
import type { PageBackgroundImageFit, PageBackgroundSettings, SpreadBackgroundMode } from './page-background.model'

/** Runtime document loaded into the page editor. */
export interface EditorDocument {
  magazineTypeId: string
  magazinePageId: string
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