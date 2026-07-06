import type Konva from 'konva'

const PAGE_BACKGROUND_NODE_NAMES = new Set([
  'page-background',
  'page-background-left',
  'page-background-right',
])

export function isPageBackgroundTarget(target: Konva.Node, stage: Konva.Stage | null): boolean {
  if (!stage) {
    return false
  }

  if (target === stage) {
    return true
  }

  return PAGE_BACKGROUND_NODE_NAMES.has(target.name())
}
