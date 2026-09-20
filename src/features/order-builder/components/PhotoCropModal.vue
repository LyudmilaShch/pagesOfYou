<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="handleDialogUpdate">
    <v-card>
      <v-card-title>Кадрировать фото</v-card-title>
      <v-card-subtitle>Перетащите фото, чтобы сдвинуть, и потяните ползунок, чтобы приблизить</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <div ref="frameRef" class="photo-crop__frame" :style="{ aspectRatio: `${boxWidth} / ${boxHeight}` }">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            class="photo-crop__image"
            :style="imageStyle"
            draggable="false"
            alt=""
            @load="handleImageLoad"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />
        </div>

        <div class="photo-crop__zoom">
          <v-icon size="16" color="grey">mdi-magnify-minus-outline</v-icon>
          <v-slider
            :model-value="crop.imageScale"
            :min="MIN_PHOTO_IMAGE_SCALE"
            :max="MAX_PHOTO_IMAGE_SCALE"
            :step="0.01"
            :disabled="!naturalSize"
            hide-details
            color="primary"
            @update:model-value="onScaleChange"
          />
          <v-icon size="16" color="grey">mdi-magnify-plus-outline</v-icon>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn variant="text" @click="resetCrop">Сбросить</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Отмена</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="!naturalSize" @click="save">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import type { PhotoFitMode } from '@/modules/editor/models'
import {
  MAX_PHOTO_IMAGE_SCALE,
  MIN_PHOTO_IMAGE_SCALE,
  clampPhotoCrop,
  computePhotoCropFromPanDelta,
  computePhotoCropZoomAtPoint,
  computePhotoImageLayout,
  resolvePhotoRenderFitMode,
  type PhotoCropState,
} from '@/modules/editor/utils/photo-crop.util'

const props = defineProps<{
  open: boolean
  imageUrl: string | null
  boxWidth: number
  boxHeight: number
  fitMode?: PhotoFitMode
  initialCrop: PhotoCropState
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [crop: PhotoCropState]
}>()

const resolvedFitMode = computed(() => resolvePhotoRenderFitMode(props.fitMode))

const crop = reactive<PhotoCropState>({ cropX: 0, cropY: 0, imageScale: 1 })
const naturalSize = ref<{ width: number; height: number } | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      crop.cropX = props.initialCrop.cropX
      crop.cropY = props.initialCrop.cropY
      crop.imageScale = props.initialCrop.imageScale
      naturalSize.value = null
    }
  },
)

function handleImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  naturalSize.value = { width: img.naturalWidth, height: img.naturalHeight }
}

const imageStyle = computed(() => {
  if (!naturalSize.value) {
    return { width: '100%', height: '100%', objectFit: 'cover' as const }
  }

  const layout = computePhotoImageLayout(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
  )
  if (!layout) {
    return { width: '100%', height: '100%', objectFit: 'cover' as const }
  }

  return {
    position: 'absolute' as const,
    left: `${(layout.x / props.boxWidth) * 100}%`,
    top: `${(layout.y / props.boxHeight) * 100}%`,
    width: `${(layout.width / props.boxWidth) * 100}%`,
    height: `${(layout.height / props.boxHeight) * 100}%`,
    maxWidth: 'none',
    cursor: 'grab',
    touchAction: 'none',
  }
})

// Percentages above (not px via a ResizeObserver-measured scale, unlike JournalSpreadThumbnail.vue)
// — the frame's own box-relative % position/size stays correct at any rendered width for free, so
// panning below just needs the frame's CURRENT pixel width to convert a screen-px drag delta into
// the same unscaled page-point space `computePhotoCropFromPanDelta` expects.
const frameRef = ref<HTMLElement | null>(null)

let dragStart: { pointerId: number; x: number; y: number; cropX: number; cropY: number } | null = null

function onPointerDown(event: PointerEvent): void {
  if (!naturalSize.value) {
    return
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cropX: crop.cropX, cropY: crop.cropY }
}

function onPointerMove(event: PointerEvent): void {
  if (!dragStart || dragStart.pointerId !== event.pointerId || !naturalSize.value || !frameRef.value) {
    return
  }

  const pixelsPerPoint = frameRef.value.clientWidth / props.boxWidth
  if (pixelsPerPoint <= 0) {
    return
  }

  const deltaX = (event.clientX - dragStart.x) / pixelsPerPoint
  const deltaY = (event.clientY - dragStart.y) / pixelsPerPoint

  const next = computePhotoCropFromPanDelta(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    { cropX: dragStart.cropX, cropY: dragStart.cropY, imageScale: crop.imageScale },
    deltaX,
    deltaY,
  )
  crop.cropX = next.cropX
  crop.cropY = next.cropY
}

function onPointerUp(event: PointerEvent): void {
  if (dragStart?.pointerId === event.pointerId) {
    dragStart = null
  }
}

function onScaleChange(nextScale: number): void {
  if (!naturalSize.value) {
    return
  }

  const next = computePhotoCropZoomAtPoint(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
    props.boxWidth / 2,
    props.boxHeight / 2,
    nextScale - crop.imageScale,
  )
  crop.cropX = next.cropX
  crop.cropY = next.cropY
  crop.imageScale = next.imageScale
}

function resetCrop(): void {
  crop.cropX = 0
  crop.cropY = 0
  crop.imageScale = 1
}

function save(): void {
  if (!naturalSize.value) {
    return
  }

  const clamped = clampPhotoCrop(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
  )
  emit('save', clamped)
}

function handleDialogUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}

onBeforeUnmount(() => {
  dragStart = null
})
</script>

<style scoped lang="scss">
.photo-crop__frame {
  position: relative;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: $radius-md;
  background: $bg-muted;
}

.photo-crop__image {
  user-select: none;
}

.photo-crop__zoom {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  margin-top: $spacing-4;
}
</style>
