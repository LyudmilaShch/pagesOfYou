import type { Position, Size } from './geometry.model'

export type PageElementType =
  | 'photo-placeholder'
  | 'text-placeholder'
  | 'title-placeholder'
  | 'subtitle-placeholder'
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-line'
  | 'group'

export interface PageElementBase {
  id: string
  type: PageElementType
  name: string
  /** Relative to the owning container's content frame; root-level elements use page coordinates. */
  position: Position
  size: Size
  /** Relative to the owning container's own rotation. */
  rotation: number
  locked: boolean
  visible: boolean
  opacity: number
  /** Admin-approved placement inside print crop zone; suppresses crop warnings. */
  printCropAllowed?: boolean
}
