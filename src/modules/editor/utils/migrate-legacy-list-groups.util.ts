import type { PageElement } from '../models'

/**
 * Lists used to be a group whose children were the rows (`group.list` set on the group, no
 * `listId` anywhere). Now rows carry the list themselves (see list.model.ts) — such a group's
 * children become rows of a list keyed by the group's id, in their child order, and the group is
 * left a plain group the admin can ungroup.
 */
export function migrateLegacyListGroups(elements: PageElement[]): PageElement[] {
  return elements.map((node) => {
    if (node.type !== 'group') {
      return node
    }
    const children = migrateLegacyListGroups(node.children)
    if (!node.list || node.listId) {
      return { ...node, children }
    }
    const { list, ...group } = node
    return {
      ...group,
      list: null,
      children: children.map((row, index) => ({ ...row, listId: node.id, listOrder: index, list })),
    }
  })
}
