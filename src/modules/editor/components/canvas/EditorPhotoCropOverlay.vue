<template>
  <div
    v-if="cropSession && frameStyle"
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
import { A4_PAGE_WIDTH } from '../../constants/page.constants'
import type { PhotoPlaceholder } from '../../models/photo-placeholder.model'
import type { PageBackgroundImageFit } from '../../models/page-background.model'
import { getPageBackgroundCropState } from '../../models/page-background.model'
import { useElementCanvasStore } from '../../composables/use-element-canvas-store'
import { useEditorStore } from '../../store/editor.store'
import {
  computePhotoImageLayout,
  getPhotoCropState,
  MAX_PHOTO_IMAGE_SCALE,
  MIN_PHOTO_IMAGE_SCALE,
  resolvePhotoRenderFitMode,
} from '../../utils/photo-crop.util'
import { getPhotoRenderBox } from '../../utils/photo-frame.util'
import { getPlaceholderPhotoUrl } from '../../utils/placeholder-display.util'
import { spreadLogicalXToVisual } from '../../utils/spread.util'
import { findNodeById, getAbsoluteTransform } from '../../utils/element-tree.util'

const props = defineProps<{
  pageOffset: { x: number; y: number }
  pageScale: number
  layoutPageWidth?: number
}>()

interface CropSession {
  mode: 'photo' | 'page-background'
  frameWidth: number
  frameHeight: number
  frameX: number
  frameY: number
  borderRadius: number
  rotation: number
  fitMode: PageBackgroundImageFit | 'contain'
  cropX: number
  cropY: number
  imageScale: number
  imageUrl: string | null
}

const orderCanvas = inject<OrderCanvasContext | null>(ORDER_CANVAS_CONTEXT_KEY, null)
const editorStore = useEditorStore()
const store = useElementCanvasStore()
const photoCropEditingElementId = computed(() =>
  orderCanvas ? orderCanvas.photoCropEditingElementId : editorStore.photoCropEditingElementId,
)
const pageBackgroundCropEditing = computed(
  () => false,
)

/** Tree-aware lookup — `store.elements` (the shared editor/order-canvas interface) is root-level
 * only in the editor; order-builder has no nesting (fed a pre-flattened list). */
function findPhotoById(id: string): PhotoPlaceholder | null {
  const found = orderCanvas ? store.elements.find((item) => item.id === id) : findNodeById(editorStore.elements, id)

  return found && found.type === 'photo-placeholder' ? (found as PhotoPlaceholder) : null
}

/** Absolute page position/rotation — for a nested element (inside a group), `position` is LOCAL
 * to its parent; only root-level elements have `position` directly in page coordinates. */
function getPhotoAbsoluteBox(id: string): { x: number; y: number; rotationDeg: number } {
  if (orderCanvas) {
    const photo = store.elements.find((item) => item.id === id)
    return { x: photo?.position.x ?? 0, y: photo?.position.y ?? 0, rotationDeg: photo?.rotation ?? 0 }
  }

  return getAbsoluteTransform(editorStore.elements, id)
}

const viewportRef = ref<HTMLElement | null>(null)
const imageNaturalSize = ref({ width: 0, height: 0 })

const panState = ref<{
  startX: number
  startY: number
  cropX: number
  cropY: number
} | null>(null)

const cropSession = computed((): CropSession | null => {
  if (pageBackgroundCropEditing.value) {
    const background = editorStore.editablePageBackground
    const target = editorStore.pageBackgroundCropTarget
    const imageUrl = background.backgroundImageUrl
    if (!imageUrl) {
      return null
    }

    const frameWidth =
      target === 'left' || target === 'right'
        ? A4_PAGE_WIDTH
        : props.layoutPageWidth ?? editorStore.pageWidth
    const frameX =
      target === 'right' ? A4_PAGE_WIDTH : 0

    return {
      mode: 'page-background',
      frameWidth,
      frameHeight: editorStore.pageHeight,
      frameX,
      frameY: 0,
      borderRadius: 0,
      rotation: 0,
      fitMode: background.backgroundImageFit,
      cropX: background.backgroundImageCropX,
      cropY: background.backgroundImageCropY,
      imageScale: background.backgroundImageScale,
      imageUrl,
    }
  }

  if (!photoCropEditingElementId.value) {
    return null
  }

  const photo = findPhotoById(photoCropEditingElementId.value)
  if (!photo) {
    return null
  }

  const url = getPlaceholderPhotoUrl(photo, photo.defaultImageUrl)
  const box = getPhotoRenderBox(photo.frame, photo.size.width, photo.size.height)
  const absoluteBox = getPhotoAbsoluteBox(photo.id)

  return {
    mode: 'photo',
    frameWidth: box.width,
    frameHeight: box.height,
    frameX: absoluteBox.x + box.x,
    frameY: absoluteBox.y + box.y,
    borderRadius: photo.borderRadius,
    rotation: absoluteBox.rotationDeg,
    fitMode: resolvePhotoRenderFitMode(photo.fitMode),
    cropX: photo.cropX,
    cropY: photo.cropY,
    imageScale: photo.imageScale,
    imageUrl: url,
  }
})

const photoElement = computed(() => {
  if (cropSession.value?.mode !== 'photo' || !photoCropEditingElementId.value) {
    return null
  }

  return findPhotoById(photoCropEditingElementId.value)
})

const imageSrc = computed(() => {
  const url = cropSession.value?.imageUrl
  return url ? resolveAssetUrl(url) : null
})

const frameStyle = computed(() => {
  if (!cropSession.value) {
    return null
  }

  const session = cropSession.value
  const scale = props.pageScale
  const visualX =
    session.mode === 'photo'
      ? spreadLogicalXToVisual(
          session.frameX,
          store.pageWidth,
          store.pageHeight,
          session.frameWidth,
        )
      : session.frameX

  return {
    left: `${props.pageOffset.x + visualX * scale}px`,
    top: `${props.pageOffset.y + session.frameY * scale}px`,
    width: `${session.frameWidth * scale}px`,
    height: `${session.frameHeight * scale}px`,
    borderRadius: session.borderRadius ? `${session.borderRadius * scale}px` : undefined,
    transform: session.rotation ? `rotate(${session.rotation}deg)` : undefined,
    transformOrigin: 'top left',
  }
})

const imageStyle = computed(() => {
  if (!cropSession.value || imageNaturalSize.value.width <= 0) {
    return undefined
  }

  const session = cropSession.value
  const crop =
    session.mode === 'photo'
      ? getPhotoCropState(photoElement.value ?? { cropX: 0, cropY: 0, imageScale: 1 })
      : getPageBackgroundCropState(session)

  const layout = computePhotoImageLayout(
    session.frameWidth,
    session.frameHeight,
    imageNaturalSize.value.width,
    imageNaturalSize.value.height,
    resolvePhotoRenderFitMode(session.fitMode),
    crop,
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
  [imageSrc, () => cropSession.value?.mode, () => photoElement.value?.id],
  () => {
    imageNaturalSize.value = { width: 0, height: 0 }

    if (!imageSrc.value || !cropSession.value) {
      return
    }

    const image = new Image()
    image.onload = () => {
      imageNaturalSize.value = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }

      if (cropSession.value?.mode === 'page-background') {
        editorStore.registerPageBackgroundImageDimensions(imageNaturalSize.value)
        return
      }

      if (photoElement.value) {
        store.registerPhotoImageDimensions(photoElement.value.id, imageNaturalSize.value)
      }
    }
    image.src = imageSrc.value
  },
  { immediate: true },
)

function applyCropPatch(
  patch: Partial<{ cropX: number; cropY: number; imageScale: number }>,
  options?: { live?: boolean },
): void {
  if (!cropSession.value) {
    return
  }

  if (cropSession.value.mode === 'page-background') {
    editorStore.updatePageBackgroundCrop(patch, options)
    return
  }

  if (photoElement.value) {
    store.updatePhotoCrop(photoElement.value.id, patch, options)
  }
}

function handlePanMove(event: MouseEvent): void {
  if (!panState.value || !cropSession.value) {
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
  if (!cropSession.value || event.button !== 0) {
    return
  }

  event.preventDefault()
  panState.value = {
    startX: event.clientX,
    startY: event.clientY,
    cropX: cropSession.value.cropX,
    cropY: cropSession.value.cropY,
  }

  window.addEventListener('mousemove', handlePanMove)
  window.addEventListener('mouseup', handlePanEnd)
}

function handleWheel(event: WheelEvent): void {
  if (!cropSession.value || imageNaturalSize.value.width <= 0) {
    return
  }

  const step = event.deltaY > 0 ? -0.08 : 0.08
  const nextScale = Math.max(
    MIN_PHOTO_IMAGE_SCALE,
    Math.min(MAX_PHOTO_IMAGE_SCALE, cropSession.value.imageScale + step),
  )

  if (Math.abs(nextScale - cropSession.value.imageScale) < 0.001) {
    return
  }

  applyCropPatch({ imageScale: nextScale })
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && cropSession.value) {
    event.preventDefault()
    if (cropSession.value.mode === 'page-background') {
      editorStore.stopPageBackgroundCropEditing()
      return
    }

    store.stopPhotoCropEditing()
  }
}

watch(
  cropSession,
  (session) => {
    if (session) {
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
