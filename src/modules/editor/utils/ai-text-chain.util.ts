import type { PageElement } from '../models'
import { isAiTextElement } from '../models'
import type { AiTextPlaceholder } from '../models/ai-text-placeholder.model'
import { walkTree } from './element-tree.util'

/** Fields that belong to the whole chained text, not to one part — editing them on any part
 * writes them to every part (see the editor store's `updateAiTextShared`). */
export const AI_TEXT_SHARED_FIELDS = ['prompt', 'questionKeys', 'chainMode', 'contentSource'] as const

export type AiTextSharedPatch = Partial<Pick<AiTextPlaceholder, (typeof AI_TEXT_SHARED_FIELDS)[number]>>

let chainIdCounter = 0

export function generateAiTextChainId(): string {
  chainIdCounter += 1
  return `ai-chain-${Date.now()}-${chainIdCounter}`
}

/** Every part of `chainId` in reading order — `chainOrder` ascending, tree order as the tiebreak
 * (two parts can briefly share an order, e.g. pasted in from another template). */
export function getAiTextChainParts(elements: PageElement[], chainId: string): AiTextPlaceholder[] {
  const parts: AiTextPlaceholder[] = []
  walkTree(elements, (node) => {
    if (isAiTextElement(node) && node.chainId === chainId) {
      parts.push(node)
    }
  })
  return parts
    .map((part, treeIndex) => ({ part, treeIndex }))
    .sort((a, b) => a.part.chainOrder - b.part.chainOrder || a.treeIndex - b.treeIndex)
    .map(({ part }) => part)
}

/** The parts `element` belongs to — just `[element]` for a standalone block, so callers can treat
 * "one block" and "a chain of one" the same way. */
export function getAiTextSiblingParts(elements: PageElement[], element: AiTextPlaceholder): AiTextPlaceholder[] {
  if (!element.chainId) {
    return [element]
  }
  const parts = getAiTextChainParts(elements, element.chainId)
  return parts.length > 0 ? parts : [element]
}

/** True when both ids are parts of the same chain — the properties panels use it to stay on the
 * AI-text config screen while the admin hops between parts from its part list. */
export function areAiTextChainSiblings(
  elements: PageElement[],
  firstId: string | null | undefined,
  secondId: string | null | undefined,
): boolean {
  if (!firstId || !secondId || firstId === secondId) {
    return false
  }
  let firstChainId: string | null = null
  let secondChainId: string | null = null
  walkTree(elements, (node) => {
    if (isAiTextElement(node)) {
      if (node.id === firstId) firstChainId = node.chainId
      if (node.id === secondId) secondChainId = node.chainId
    }
  })
  return firstChainId !== null && firstChainId === secondChainId
}

/** chainId → its parts, for every chain on the page with 2+ parts (a chain left with a single
 * part after deletions behaves exactly like a standalone block, so it isn't reported). */
export function collectAiTextChains(elements: PageElement[]): Map<string, AiTextPlaceholder[]> {
  const chainIds = new Set<string>()
  walkTree(elements, (node) => {
    if (isAiTextElement(node) && node.chainId) {
      chainIds.add(node.chainId)
    }
  })

  const chains = new Map<string, AiTextPlaceholder[]>()
  for (const chainId of chainIds) {
    const parts = getAiTextChainParts(elements, chainId)
    if (parts.length > 1) {
      chains.set(chainId, parts)
    }
  }
  return chains
}
