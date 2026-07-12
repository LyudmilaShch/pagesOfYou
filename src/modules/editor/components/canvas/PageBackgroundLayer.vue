<template>
  <v-rect
    :config="colorRectConfig"
    @dblclick="handleDblClick"
    @dbltap="handleDblClick"
  />
  <v-image
    v-if="loadedImage && imageConfig && !suppressImage"
    :config="{ ...imageConfig, image: loadedImage }"
    @dblclick="handleDblClick"
    @dbltap="handleDblClick"
  />
</template>

<script setup lang="ts">
import type Konva from 'konva'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
  getPageBackgroundCropState,
  normalizePageBackgroundImageFit,
  type PageBackgroundImageFit,
} from '../../models/page-background.model'
import { computePageBackgroundImageKonvaConfig } from '../../utils/page-background-image.util'
import { loadHtmlImage } from '../../utils/load-image.util'
import { resolveAssetUrl } from '@/shared/config/assets'

const props = withDefaults(
  defineProps<{
    pageWidth: number
    pageHeight: number
    backgroundColor: string
    backgroundImageUrl?: string | null
    backgroundImageFit?: PageBackgroundImageFit
    backgroundImageCropX?: number
    backgroundImageCropY?: number
    backgroundImageScale?: number
    suppressImage?: boolean
    nodeName?: string
  }>(),
  {
    backgroundImageUrl: null,
    backgroundImageFit: DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
    backgroundImageCropX: 0,
    backgroundImageCropY: 0,
    backgroundImageScale: 1,
    suppressImage: false,
    nodeName: 'page-background',
  },
)

const emit = defineEmits<{
  backgroundDblclick: []
}>()

const loadedImage = ref<HTMLImageElement | null>(null)
let loadToken = 0

const colorRectConfig = computed(() => ({
  name: props.nodeName,
  x: 0,
  y: 0,
  width: props.pageWidth,
  height: props.pageHeight,
  fill: props.backgroundColor,
  listening: true,
}))

function handleDblClick(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  event.cancelBubble = true
  emit('backgroundDblclick')
}

const imageConfig = computed(() => {
  if (!loadedImage.value) {
    return null
  }

  return computePageBackgroundImageKonvaConfig(
    props.pageWidth,
    props.pageHeight,
    loadedImage.value,
    normalizePageBackgroundImageFit(props.backgroundImageFit),
    getPageBackgroundCropState({
      cropX: props.backgroundImageCropX,
      cropY: props.backgroundImageCropY,
      imageScale: props.backgroundImageScale,
    }),
  )
})

async function loadBackgroundImage(): Promise<void> {
  loadToken += 1
  const token = loadToken
  loadedImage.value = null

  const rawUrl = props.backgroundImageUrl?.trim()
  if (!rawUrl) {
    return
  }

  const url = resolveAssetUrl(rawUrl) ?? rawUrl

  try {
    const image = await loadHtmlImage(url)
    if (token === loadToken) {
      loadedImage.value = image
    }
  } catch {
    loadedImage.value = null
  }
}

watch(
  () =>
    [
      props.backgroundImageUrl,
      props.pageWidth,
      props.pageHeight,
      props.backgroundImageFit,
    ] as const,
  () => {
    void loadBackgroundImage()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  loadToken += 1
})
</script>
