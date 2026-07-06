import type { PageElementBase } from './page-element.model'

export interface BackgroundElement extends PageElementBase {
  type: 'background'
  color: string
}
