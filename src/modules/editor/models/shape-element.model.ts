import type { PageElementBase } from './page-element.model'
import type { ShapeShadow } from './shape-shadow.model'
import type { ShapeVisualEffect } from './shape-visual-effect.model'

export interface ShapeElement extends PageElementBase {
  type: 'shape-rectangle' | 'shape-circle' | 'shape-line'
  fill: string
  stroke: string
  strokeWidth: number
  /** Corner radius — only meaningful for 'shape-rectangle'. */
  cornerRadius: number
  shadow: ShapeShadow | null
  visualEffect: ShapeVisualEffect | null
}
