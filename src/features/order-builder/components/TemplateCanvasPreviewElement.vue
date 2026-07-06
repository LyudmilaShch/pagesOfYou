<template>
  <v-group :config="outerGroupConfig">
    <v-group :config="innerGroupConfig">
      <v-rect v-if="backgroundRectConfig" :config="backgroundRectConfig" />

      <template v-if="element.type === 'photo-placeholder'">
        <v-rect v-if="photoGridConfig" :config="photoGridConfig" />
        <v-image
          v-if="photoImageConfig && loadedImage"
          :config="{ ...photoImageConfig, image: loadedImage }"
        />
      </template>

      <v-rect v-if="shapeRectConfig" :config="shapeRectConfig" />
      <v-circle v-if="shapeCircleConfig" :config="shapeCircleConfig" />
      <v-line v-if="shapeLineConfig" :config="shapeLineConfig" />
      <v-text v-if="textConfig" :config="textConfig" />
    </v-group>
  </v-group>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  getElementInnerGroupConfig,
  getElementOuterGroupConfig,
  getPhotoImageKonvaConfig,
  getPhotoPlaceholderGridConfig,
  getShapeCircleConfig,
  getShapeLineConfig,
  getShapeRectConfig,
  getTextConfig,
} from '@/modules/editor/adapters/konva/element-node.adapter'
import type { PageElement } from '@/modules/editor/models'
import { getPlaceholderDisplayText, getPlaceholderPhotoUrl } from '@/modules/editor/utils/placeholder-display.util'
import { loadHtmlImage } from '@/modules/editor/utils/load-image.util'
import { resolveAssetUrl } from '@/shared/config/assets'

const props = defineProps<{
  element: PageElement
}>()

const loadedImage = ref<HTMLImageElement | null>(null)
let loadToken = 0

const outerGroupConfig = computed(() => ({
  ...getElementOuterGroupConfig(props.element),
  draggable: false,
  listening: false,
}))

const innerGroupConfig = computed(() => ({
  ...getElementInnerGroupConfig(props.element),
  listening: false,
}))

const backgroundRectConfig = computed(() => {
  if (props.element.type !== 'background') {
    return null
  }

  return {
    x: 0,
    y: 0,
    width: props.element.size.width,
    height: props.element.size.height,
    fill: props.element.color,
    listening: false,
  }
})

const photoGridConfig = computed(() => {
  if (props.element.type !== 'photo-placeholder' || loadedImage.value) {
    return null
  }

  return getPhotoPlaceholderGridConfig(props.element)
})

const photoImageConfig = computed(() => {
  if (props.element.type !== 'photo-placeholder' || !loadedImage.value) {
    return null
  }

  return getPhotoImageKonvaConfig(props.element, loadedImage.value)
})

const shapeRectConfig = computed(() => getShapeRectConfig(props.element))
const shapeCircleConfig = computed(() => getShapeCircleConfig(props.element))
const shapeLineConfig = computed(() => getShapeLineConfig(props.element))

const textConfig = computed(() =>
  getTextConfig(props.element, getPlaceholderDisplayText(props.element)),
)

async function loadPhoto(): Promise<void> {
  loadToken += 1
  const token = loadToken
  loadedImage.value = null

  if (props.element.type !== 'photo-placeholder') {
    return
  }

  const rawUrl = getPlaceholderPhotoUrl(props.element)
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
  () => props.element,
  () => {
    void loadPhoto()
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  loadToken += 1
})
</script>
