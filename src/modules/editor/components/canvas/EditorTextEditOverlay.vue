<template>
  <div
    v-if="element && overlayStyle"
    class="editor-text-edit"
    :style="overlayStyle"
  >
    <textarea
      ref="textareaRef"
      class="editor-text-edit__input"
      :value="draft"
      :style="textareaStyle"
      spellcheck="false"
      @input="handleInput"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { TEXT_BOX_PADDING } from '../../constants/text.constants'
import type { TextPlaceholder } from '../../models/text-placeholder.model'
import {
  useElementCanvasStore,
  useOrderCanvasStoreOrNull,
} from '../../composables/use-element-canvas-store'
import { useEditorStore } from '../../store/editor.store'
import { isTextPlaceholderElement } from '../../utils/placeholder-display.util'
import {
  applyTextContentChange,
  resolveTextEditingDraft,
} from '../../utils/text-layout.util'
import { spreadLogicalXToVisual } from '../../utils/spread.util'
import { findNodeById, getAbsoluteTransform } from '../../utils/element-tree.util'

const props = defineProps<{
  pageOffset: { x: number; y: number }
  pageScale: number
}>()

const orderCanvas = useOrderCanvasStoreOrNull()
const editorStore = useEditorStore()
const store = useElementCanvasStore()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const draft = ref('')

const textEditingElementId = computed(() =>
  orderCanvas ? orderCanvas.textEditingElementId : editorStore.textEditingElementId,
)

/** Tree-aware lookup — `store.elements` (the shared editor/order-canvas interface) is root-level
 * only in the editor; order-builder has no nesting (fed a pre-flattened list). */
function findElementById(id: string): TextPlaceholder | null {
  const found = orderCanvas
    ? store.elements.find((item) => item.id === id)
    : findNodeById(editorStore.elements, id)

  return found && isTextPlaceholderElement(found) ? (found as TextPlaceholder) : null
}

const element = computed(() => {
  if (!textEditingElementId.value) {
    return null
  }

  return findElementById(textEditingElementId.value)
})

/** Absolute page position/rotation — for a nested element (inside a group), `element.position` is
 * LOCAL to its parent; only root-level elements have `position` directly in page coordinates. */
const absoluteBox = computed(() => {
  if (!element.value) {
    return null
  }

  if (orderCanvas) {
    return { x: element.value.position.x, y: element.value.position.y, rotationDeg: 0 }
  }

  return getAbsoluteTransform(editorStore.elements, element.value.id)
})

const overlayStyle = computed(() => {
  if (!element.value || !absoluteBox.value) {
    return null
  }

  const scale = props.pageScale
  const padding = TEXT_BOX_PADDING * scale
  const visualX = spreadLogicalXToVisual(
    absoluteBox.value.x,
    store.pageWidth,
    store.pageHeight,
    element.value.size.width,
  )

  return {
    left: `${props.pageOffset.x + visualX * scale}px`,
    top: `${props.pageOffset.y + absoluteBox.value.y * scale}px`,
    width: `${element.value.size.width * scale}px`,
    height: `${element.value.size.height * scale}px`,
    padding: `${padding}px`,
    transform: absoluteBox.value.rotationDeg
      ? `rotate(${absoluteBox.value.rotationDeg}deg)`
      : undefined,
    transformOrigin: 'center center',
  }
})

const textareaStyle = computed(() => {
  if (!element.value) {
    return undefined
  }

  const scale = props.pageScale
  const textEl = element.value

  return {
    fontFamily: textEl.fontFamily,
    fontSize: `${textEl.fontSize * scale}px`,
    fontWeight: textEl.fontWeight >= 600 ? 700 : 400,
    fontStyle: textEl.fontItalic ? 'italic' : 'normal',
    lineHeight: String(textEl.lineHeight),
    letterSpacing: `${textEl.letterSpacing}px`,
    textAlign: textEl.textAlign,
    color: textEl.color,
    textTransform: textEl.textTransform === 'uppercase' ? 'uppercase' : 'none',
  }
})

watch(
  () => textEditingElementId.value,
  async (id) => {
    if (!id) {
      draft.value = ''
      return
    }

    const current = findElementById(id)
    if (!current) {
      return
    }

    draft.value = resolveTextEditingDraft(
      current,
      orderCanvas ? (id) => orderCanvas.getTextValue(id) : undefined,
    )
    await nextTick()
    textareaRef.value?.focus()
    textareaRef.value?.select()
  },
  { immediate: true },
)

function handleInput(event: Event): void {
  if (!element.value) {
    return
  }

  const value = (event.target as HTMLTextAreaElement).value
  draft.value = value
  applyTextContentChange(store.updateElement.bind(store), element.value.id, value)
}

function handleBlur(): void {
  store.stopTextEditing()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    store.stopTextEditing()
  }
}
</script>

<style scoped lang="scss">
.editor-text-edit {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  border: 1px solid $text-primary;
  background: transparent;
  pointer-events: auto;
}

.editor-text-edit__input {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  overflow: hidden;
}
</style>
