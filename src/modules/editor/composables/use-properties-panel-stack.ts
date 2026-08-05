import { computed, readonly, ref } from 'vue'

export interface PanelScreenEntry {
  /** Registry id — matches a key in PANEL_SCREENS, e.g. 'text-effects'. */
  id: string
  /** Header title for non-root screens. */
  title?: string
  /** Optional payload for parametrized screens. */
  params?: Record<string, unknown>
}

export function usePropertiesPanelStack(getRootEntry: () => PanelScreenEntry) {
  const stack = ref<PanelScreenEntry[]>([getRootEntry()])
  const direction = ref<'forward' | 'back'>('forward')

  const current = computed(() => stack.value[stack.value.length - 1])
  const isRoot = computed(() => stack.value.length === 1)

  function push(entry: PanelScreenEntry): void {
    direction.value = 'forward'
    stack.value = [...stack.value, entry]
  }

  function pop(): void {
    if (stack.value.length <= 1) {
      return
    }
    direction.value = 'back'
    stack.value = stack.value.slice(0, -1)
  }

  function reset(entry: PanelScreenEntry): void {
    direction.value = 'forward'
    stack.value = [entry]
  }

  return {
    stack: readonly(stack),
    current,
    isRoot,
    direction: readonly(direction),
    push,
    pop,
    reset,
  }
}

export type PropertiesPanelStack = ReturnType<typeof usePropertiesPanelStack>
