import type { Position, Size } from './geometry.model'

export type PageElementType =
  | 'photo-placeholder'
  | 'text-placeholder'
  | 'title-placeholder'
  | 'subtitle-placeholder'
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-line'
  | 'background'

export interface PageElementBase {
  id: string
  type: PageElementType
  name: string
  position: Position
  size: Size
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  opacity: number
  /** Admin-approved placement inside print crop zone; suppresses crop warnings. */
  printCropAllowed?: boolean
}
