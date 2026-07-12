import type Konva from 'konva'

export type PageBackgroundCropTarget = 'spread' | 'left' | 'right'

const PAGE_BACKGROUND_NODE_NAMES = new Set([
  'page-background',
  'page-background-left',
  'page-background-right',
])

export function getPageBackgroundNodeName(
  target: PageBackgroundCropTarget,
): string {
  if (target === 'left') {
    return 'page-background-left'
  }

  if (target === 'right') {
    return 'page-background-right'
  }

  return 'page-background'
}

export function resolvePageBackgroundCropTargetFromNodeName(
  name: string,
): PageBackgroundCropTarget | null {
  if (name === 'page-background-left') {
    return 'left'
  }

  if (name === 'page-background-right') {
    return 'right'
  }

  if (name === 'page-background') {
    return 'spread'
  }

  return null
}

const PAGE_BACKGROUND_CROP_NODE_NAMES = new Set([
  'page-background-crop-pan',
  'page-background-crop-scale',
])

export function isPageBackgroundCropTransformerTarget(target: Konva.Node): boolean {
  let node: Konva.Node | null = target

  while (node) {
    if (PAGE_BACKGROUND_CROP_NODE_NAMES.has(node.name())) {
      return true
    }

    node = node.parent
  }

  return false
}

export function isPageBackgroundTarget(target: Konva.Node, stage: Konva.Stage | null): boolean {
  if (!stage) {
    return false
  }

  if (target === stage) {
    return true
  }

  return PAGE_BACKGROUND_NODE_NAMES.has(target.name())
}
