<template>
  <v-group ref="rootGroupRef" :config="rootGroupConfig">
    <v-rect :config="pageFrameConfig" />

    <v-group :config="clipGroupConfig">
      <v-image
        v-if="loadedImage && imageConfig"
        :config="{ ...imageConfig, image: loadedImage }"
      />
    </v-group>

    <v-rect v-if="imageBoundsConfig" :config="imageBoundsConfig" />

    <v-rect
      v-if="panHitConfig"
      :config="panHitConfig"
      @mouseenter="handlePanHitEnter"
      @mouseleave="handlePanHitLeave"
      @mousedown="handlePanPointerDown"
      @touchstart="handlePanPointerDown"
    />

    <v-circle
      v-for="handle in scaleHandles"
      :key="handle.corner"
      :config="handle.config"
      @mouseenter="handleScaleHandleEnter(handle.corner)"
      @mouseleave="handleScaleHandleLeave"
      @mousedown="handleScalePointerDown(handle.corner, $event)"
      @touchstart="handleScalePointerDown(handle.corner, $event)"
    />
  </v-group>
</template>

<script setup lang="ts">
import type Konva from 'konva'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { A4_PAGE_WIDTH } from '../../constants/page.constants'
import {
  getPageBackgroundCropState,
  normalizePageBackgroundImageFit,
} from '../../models/page-background.model'
import { useEditorStore } from '../../store/editor.store'
import { loadHtmlImage } from '../../utils/load-image.util'
import {
  getPageBackgroundCropImageBoundsConfig,
  getPageBackgroundCropPageFrameConfig,
  getPageBackgroundCropPanHitConfig,
  getPageBackgroundCropScaleHandleConfigs,
} from '../../utils/page-background-crop.util'
import { computePageBackgroundImageKonvaConfig } from '../../utils/page-background-image.util'
import {
  computePhotoCropFromCornerDrag,
  computePhotoCropFromPanDelta,
  computePhotoImageLayout,
  getImagePixelSize,
  getPhotoScaleCornerCursor,
  resolvePhotoRenderFitMode,
  type PhotoScaleCorner,
} from '../../utils/photo-crop.util'
import { resolveAssetUrl } from '@/shared/config/assets'

const store = useEditorStore()

const rootGroupRef = ref<{ getNode: () => Konva.Group } | null>(null)
const loadedImage = ref<HTMLImageElement | null>(null)
let loadToken = 0

const panOrigin = ref<{
  cropX: number
  cropY: number
  pointerX: number
  pointerY: number
} | null>(null)

const activeScaleCorner = ref<PhotoScaleCorner | null>(null)

const cropFrame = computed(() => {
  const target = store.pageBackgroundCropTarget
  const height = store.pageHeight

  if (target === 'left') {
    return { x: 0, width: A4_PAGE_WIDTH, height }
  }

  if (target === 'right') {
    return { x: A4_PAGE_WIDTH, width: A4_PAGE_WIDTH, height }
  }

  return { x: 0, width: store.pageWidth, height }
})

const cropSettings = computed(() => store.pageBackgroundCropSettings)

const cropState = computed(() =>
  getPageBackgroundCropState({
    cropX: cropSettings.value.backgroundImageCropX,
    cropY: cropSettings.value.backgroundImageCropY,
    imageScale: cropSettings.value.backgroundImageScale,
  }),
)

const rootGroupConfig = computed(() => ({
  x: cropFrame.value.x,
  y: 0,
  listening: true,
}))

const pageFrameConfig = computed(() =>
  getPageBackgroundCropPageFrameConfig(cropFrame.value.width, cropFrame.value.height),
)

const clipGroupConfig = computed(() => ({
  clip: {
    x: 0,
    y: 0,
    width: cropFrame.value.width,
    height: cropFrame.value.height,
  },
}))

const imageLayout = computed(() => {
  if (!loadedImage.value || !cropSettings.value?.backgroundImageUrl) {
    return null
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(loadedImage.value)
  const fitMode = normalizePageBackgroundImageFit(cropSettings.value.backgroundImageFit)

  return computePhotoImageLayout(
    cropFrame.value.width,
    cropFrame.value.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(fitMode),
    cropState.value,
  )
})

const imageConfig = computed(() => {
  if (!loadedImage.value || !cropSettings.value) {
    return null
  }

  return computePageBackgroundImageKonvaConfig(
    cropFrame.value.width,
    cropFrame.value.height,
    loadedImage.value,
    normalizePageBackgroundImageFit(cropSettings.value.backgroundImageFit),
    cropState.value,
  )
})

const imageBoundsConfig = computed(() =>
  imageLayout.value ? getPageBackgroundCropImageBoundsConfig(imageLayout.value) : null,
)

const panHitConfig = computed(() => {
  const fitMode = normalizePageBackgroundImageFit(cropSettings.value?.backgroundImageFit)
  if (fitMode === 'fill' || !imageLayout.value) {
    return null
  }

  return getPageBackgroundCropPanHitConfig(imageLayout.value)
})

const scaleHandles = computed(() => {
  const fitMode = normalizePageBackgroundImageFit(cropSettings.value?.backgroundImageFit)
  if (fitMode === 'fill' || !imageLayout.value) {
    return []
  }

  return getPageBackgroundCropScaleHandleConfigs(imageLayout.value)
})

async function loadBackgroundImage(): Promise<void> {
  loadToken += 1
  const token = loadToken
  loadedImage.value = null

  const rawUrl = cropSettings.value?.backgroundImageUrl?.trim()
  if (!rawUrl) {
    return
  }

  const url = resolveAssetUrl(rawUrl) ?? rawUrl

  try {
    const image = await loadHtmlImage(url)
    if (token === loadToken) {
      loadedImage.value = image
      store.registerPageBackgroundImageDimensions(getImagePixelSize(image))
    }
  } catch {
    loadedImage.value = null
  }
}

watch(
  () => store.pageBackgroundCropEditing,
  (active) => {
    if (!active) {
      resetStageCursor()
    }
  },
)

watch(
  () => cropSettings.value?.backgroundImageUrl,
  () => {
    void loadBackgroundImage()
  },
  { immediate: true },
)

function getPointerInFrameLocal(): { x: number; y: number } | null {
  const local = rootGroupRef.value?.getNode()?.getRelativePointerPosition()
  if (!local) {
    return null
  }

  return { x: local.x, y: local.y }
}

function getStageContainer(): HTMLElement | null {
  return rootGroupRef.value?.getNode()?.getStage()?.container() ?? null
}

function setStageCursor(cursor: string): void {
  const container = getStageContainer()

  if (container) {
    container.style.cursor = cursor
  }
}

function resetStageCursor(): void {
  setStageCursor('')
}

function handlePanHitEnter(): void {
  if (activeScaleCorner.value) {
    return
  }

  setStageCursor('grab')
}

function handlePanHitLeave(): void {
  if (panOrigin.value || activeScaleCorner.value) {
    return
  }

  resetStageCursor()
}

function handleScaleHandleEnter(corner: PhotoScaleCorner): void {
  setStageCursor(getPhotoScaleCornerCursor(corner))
}

function handleScaleHandleLeave(): void {
  if (activeScaleCorner.value) {
    return
  }

  resetStageCursor()
}

function stopPanTracking(): void {
  window.removeEventListener('mousemove', handlePanPointerMove)
  window.removeEventListener('mouseup', handlePanPointerUp)
  window.removeEventListener('touchmove', handlePanPointerMove)
  window.removeEventListener('touchend', handlePanPointerUp)
}

function stopScaleTracking(): void {
  window.removeEventListener('mousemove', handleScalePointerMove)
  window.removeEventListener('mouseup', handleScalePointerUp)
  window.removeEventListener('touchmove', handleScalePointerMove)
  window.removeEventListener('touchend', handleScalePointerUp)
}

function handlePanPointerMove(event: MouseEvent | TouchEvent): void {
  if (!panOrigin.value || !loadedImage.value || !cropSettings.value) {
    return
  }

  event.preventDefault()
  setStageCursor('grabbing')

  const local = getPointerInFrameLocal()
  if (!local) {
    return
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(loadedImage.value)
  const fitMode = normalizePageBackgroundImageFit(cropSettings.value.backgroundImageFit)

  const nextCrop = computePhotoCropFromPanDelta(
    cropFrame.value.width,
    cropFrame.value.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(fitMode),
    {
      cropX: panOrigin.value.cropX,
      cropY: panOrigin.value.cropY,
      imageScale: cropSettings.value.backgroundImageScale,
    },
    local.x - panOrigin.value.pointerX,
    local.y - panOrigin.value.pointerY,
  )

  store.updatePageBackgroundCrop(nextCrop, { live: true })
}

function handlePanPointerUp(): void {
  if (!panOrigin.value) {
    return
  }

  panOrigin.value = null
  stopPanTracking()
  setStageCursor('grab')
  store.finalizeLiveTransform()
}

function handlePanPointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (!cropSettings.value || activeScaleCorner.value) {
    return
  }

  event.cancelBubble = true
  event.evt.preventDefault()

  const local = getPointerInFrameLocal()
  if (!local) {
    return
  }

  panOrigin.value = {
    cropX: cropSettings.value.backgroundImageCropX,
    cropY: cropSettings.value.backgroundImageCropY,
    pointerX: local.x,
    pointerY: local.y,
  }
  setStageCursor('grabbing')
  stopPanTracking()
  window.addEventListener('mousemove', handlePanPointerMove)
  window.addEventListener('mouseup', handlePanPointerUp)
  window.addEventListener('touchmove', handlePanPointerMove, { passive: false })
  window.addEventListener('touchend', handlePanPointerUp)
}

function applyScaleFromPointer(corner: PhotoScaleCorner): void {
  if (!loadedImage.value || !cropSettings.value) {
    return
  }

  const local = getPointerInFrameLocal()
  if (!local) {
    return
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(loadedImage.value)
  const fitMode = normalizePageBackgroundImageFit(cropSettings.value.backgroundImageFit)

  const nextCrop = computePhotoCropFromCornerDrag(
    cropFrame.value.width,
    cropFrame.value.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(fitMode),
    cropState.value,
    corner,
    local.x,
    local.y,
  )

  store.updatePageBackgroundCrop(nextCrop, { live: true })
}

function handleScalePointerMove(event: MouseEvent | TouchEvent): void {
  if (!activeScaleCorner.value) {
    return
  }

  event.preventDefault()
  setStageCursor(getPhotoScaleCornerCursor(activeScaleCorner.value))
  applyScaleFromPointer(activeScaleCorner.value)
}

function handleScalePointerUp(): void {
  if (!activeScaleCorner.value) {
    return
  }

  const corner = activeScaleCorner.value
  activeScaleCorner.value = null
  stopScaleTracking()
  setStageCursor(getPhotoScaleCornerCursor(corner))
  store.finalizeLiveTransform()
}

function handleScalePointerDown(
  corner: PhotoScaleCorner,
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
): void {
  if (!cropSettings.value) {
    return
  }

  event.cancelBubble = true
  event.evt.preventDefault()

  activeScaleCorner.value = corner
  setStageCursor(getPhotoScaleCornerCursor(corner))
  stopScaleTracking()
  window.addEventListener('mousemove', handleScalePointerMove)
  window.addEventListener('mouseup', handleScalePointerUp)
  window.addEventListener('touchmove', handleScalePointerMove, { passive: false })
  window.addEventListener('touchend', handleScalePointerUp)
  applyScaleFromPointer(corner)
}

onBeforeUnmount(() => {
  loadToken += 1
  stopPanTracking()
  stopScaleTracking()
  resetStageCursor()
})
</script>
