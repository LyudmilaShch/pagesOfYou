import type { Position, Size } from './geometry.model'
import type { ListSettings } from './list.model'

export type PageElementType =
  | 'photo-placeholder'
  | 'text-placeholder'
  | 'title-placeholder'
  | 'subtitle-placeholder'
  | 'ai-text-placeholder'
  | 'toc-placeholder'
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
  /** As a list row: the list it belongs to, its place in the reading order, and the list-wide
   * settings (mirrored on every row). See list.model.ts / list-distribution.util.ts. */
  listId?: string | null
  listOrder?: number
  list?: ListSettings | null
  /** As a list row: starts a new column — the rows' path doesn't run across the jump from the
   * previous row. */
  listColumnBreak?: boolean
}
