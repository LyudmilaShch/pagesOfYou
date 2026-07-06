import type { PageElementBase } from './page-element.model'

export interface ShapeElement extends PageElementBase {
  type: 'shape-rectangle' | 'shape-circle' | 'shape-line'
  fill: string
  stroke: string
  strokeWidth: number
}
