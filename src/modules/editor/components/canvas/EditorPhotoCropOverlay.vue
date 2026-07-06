<template>
  <div
    v-if="element && frameStyle"
    class="editor-photo-crop"
    :style="frameStyle"
  >
    <div
      ref="viewportRef"
      class="editor-photo-crop__viewport"
      @mousedown="handlePanStart"
      @wheel.prevent="handleWheel"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :style="imageStyle"
        draggable="false"
        alt=""
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'

import {
  ORDER_CANVAS_CONTEXT_KEY,
  type OrderCanvasContext,
} from '@/features/order-builder/canvas/order-canvas.types'

import { resolveAssetUrl } from '@/shared/config/assets'
import type { PhotoPlaceholder } from '../../models/photo-placeholder.model'
import { useElementCanvasStore } from '../../composables/use-element-canvas-store'
import { useEditorStore } from '../../store/editor.store'
import {
  computePhotoImageLayout,
  getPhotoCropState,
  MAX_PHOTO_IMAGE_SCALE,
  MIN_PHOTO_IMAGE_SCALE,
  resolvePhotoRenderFitMode,
} from '../../utils/photo-crop.util'
import { getPlaceholderPhotoUrl } from '../../utils/placeholder-display.util'
import { spreadLogicalXToVisual } from '../../utils/spread.util'

const props = defineProps<{
  pageOffset: { x: number; y: number }
  pageScale: number
}>()

const orderCanvas = inject<OrderCanvasContext | null>(ORDER_CANVAS_CONTEXT_KEY, null)
const editorStore = useEditorStore()
const store = useElementCanvasStore()
const photoCropEditingElementId = computed(() =>
  orderCanvas ? orderCanvas.photoCropEditingElementId : editorStore.photoCropEditingElementId,
)

const viewportRef = ref<HTMLElement | null>(null)
const imageNaturalSize = ref({ width: 0, height: 0 })

const panState = ref<{
  startX: number
  startY: number
  cropX: number
  cropY: number
} | null>(null)

const element = computed(() => {
  if (!photoCropEditingElementId.value) {
    return null
  }

  const found = store.elements.find((item) => item.id === photoCropEditingElementId.value)
  if (!found || found.type !== 'photo-placeholder') {
    return null
  }

  return found as PhotoPlaceholder
})

const imageSrc = computed(() => {
  if (!element.value) {
    return null
  }

  const url = getPlaceholderPhotoUrl(element.value, element.value.defaultImageUrl)
  return url ? resolveAssetUrl(url) : null
})

const frameStyle = computed(() => {
  if (!element.value) {
    return null
  }

  const scale = props.pageScale
  const visualX = spreadLogicalXToVisual(
    element.value.position.x,
    store.pageWidth,
    store.pageHeight,
    element.value.size.width,
  )

  return {
    left: `${props.pageOffset.x + visualX * scale}px`,
    top: `${props.pageOffset.y + element.value.position.y * scale}px`,
    width: `${element.value.size.width * scale}px`,
    height: `${element.value.size.height * scale}px`,
    borderRadius: element.value.borderRadius ? `${element.value.borderRadius * scale}px` : undefined,
    transform: element.value.rotation
      ? `rotate(${element.value.rotation}deg)`
      : undefined,
    transformOrigin: 'top left',
  }
})

const imageStyle = computed(() => {
  if (!element.value || imageNaturalSize.value.width <= 0) {
    return undefined
  }

  const layout = computePhotoImageLayout(
    element.value.size.width,
    element.value.size.height,
    imageNaturalSize.value.width,
    imageNaturalSize.value.height,
    resolvePhotoRenderFitMode(element.value.fitMode),
    getPhotoCropState(element.value),
  )

  if (!layout) {
    return undefined
  }

  const scale = props.pageScale

  return {
    position: 'absolute',
    left: `${layout.x * scale}px`,
    top: `${layout.y * scale}px`,
    width: `${layout.width * scale}px`,
    height: `${layout.height * scale}px`,
    maxWidth: 'none',
    userSelect: 'none',
    pointerEvents: 'none',
  } as const
})

watch(
  [imageSrc, () => element.value?.id],
  () => {
    imageNaturalSize.value = { width: 0, height: 0 }

    if (!imageSrc.value || !element.value) {
      return
    }

    const image = new Image()
    image.onload = () => {
      imageNaturalSize.value = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      store.registerPhotoImageDimensions(element.value!.id, imageNaturalSize.value)
    }
    image.src = imageSrc.value
  },
  { immediate: true },
)

function applyCropPatch(
  patch: Partial<{ cropX: number; cropY: number; imageScale: number }>,
  options?: { live?: boolean },
): void {
  if (!element.value) {
    return
  }

  store.updatePhotoCrop(element.value.id, patch, options)
}

function handlePanMove(event: MouseEvent): void {
  if (!panState.value || !element.value) {
    return
  }

  const scale = props.pageScale
  const deltaX = (event.clientX - panState.value.startX) / scale
  const deltaY = (event.clientY - panState.value.startY) / scale

  applyCropPatch(
    {
      cropX: panState.value.cropX + deltaX,
      cropY: panState.value.cropY + deltaY,
    },
    { live: true },
  )
}

function handlePanEnd(): void {
  panState.value = null
  window.removeEventListener('mousemove', handlePanMove)
  window.removeEventListener('mouseup', handlePanEnd)
  store.finalizeLiveTransform()
}

function handlePanStart(event: MouseEvent): void {
  if (!element.value || event.button !== 0) {
    return
  }

  event.preventDefault()
  panState.value = {
    startX: event.clientX,
    startY: event.clientY,
    cropX: element.value.cropX,
    cropY: element.value.cropY,
  }

  window.addEventListener('mousemove', handlePanMove)
  window.addEventListener('mouseup', handlePanEnd)
}

function handleWheel(event: WheelEvent): void {
  if (!element.value || imageNaturalSize.value.width <= 0) {
    return
  }

  const step = event.deltaY > 0 ? -0.08 : 0.08
  const nextScale = Math.max(
    MIN_PHOTO_IMAGE_SCALE,
    Math.min(MAX_PHOTO_IMAGE_SCALE, element.value.imageScale + step),
  )

  if (Math.abs(nextScale - element.value.imageScale) < 0.001) {
    return
  }

  applyCropPatch({ imageScale: nextScale })
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && photoCropEditingElementId.value) {
    event.preventDefault()
    store.stopPhotoCropEditing()
  }
}

watch(
  photoCropEditingElementId,
  (id) => {
    if (id) {
      window.addEventListener('keydown', handleKeydown)
      return
    }

    window.removeEventListener('keydown', handleKeydown)
    handlePanEnd()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handlePanMove)
  window.removeEventListener('mouseup', handlePanEnd)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped lang="scss">
.editor-photo-crop {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  overflow: hidden;
  border: 2px solid $text-primary;
  background: #111111;
  pointer-events: auto;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.editor-photo-crop__viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
