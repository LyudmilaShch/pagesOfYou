import type { PageElementBase } from './page-element.model'
import type { PageElement } from './index'

/** A plain container node — a group is not a separate mechanism, just a node with children. */
export interface GroupElement extends PageElementBase {
  type: 'group'
  children: PageElement[]
}
