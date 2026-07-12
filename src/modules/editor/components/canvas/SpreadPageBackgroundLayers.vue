<template>
  <v-group
    v-for="layer in layers"
    :key="layer.key"
    :config="{ x: layer.x, y: 0 }"
  >
    <PageBackgroundLayer
      :page-width="layer.width"
      :page-height="pageHeight"
      :background-color="layer.settings.backgroundColor"
      :background-image-url="layer.settings.backgroundImageUrl"
      :background-image-fit="layer.settings.backgroundImageFit"
      :background-image-crop-x="layer.settings.backgroundImageCropX"
      :background-image-crop-y="layer.settings.backgroundImageCropY"
      :background-image-scale="layer.settings.backgroundImageScale"
      :suppress-image="isCropSuppressed(layer.key)"
      :node-name="getBackgroundNodeName(layer.key)"
      @background-dblclick="emit('backgroundDblclick', layer.key)"
    />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { CanvasData } from '../../models/canvas-data.model'
import type { PageBackgroundCropTarget } from '../../utils/canvas-background.util'
import { getPageBackgroundNodeName } from '../../utils/canvas-background.util'
import { getSpreadBackgroundRenderLayers } from '../../utils/spread-background.util'
import PageBackgroundLayer from './PageBackgroundLayer.vue'

const props = defineProps<{
  canvas: CanvasData
  pageHeight: number
  cropEditingKey?: PageBackgroundCropTarget | null
  interactive?: boolean
}>()

const emit = defineEmits<{
  backgroundDblclick: [layerKey: PageBackgroundCropTarget]
}>()

const layers = computed(() => getSpreadBackgroundRenderLayers(props.canvas))

function getBackgroundNodeName(key: PageBackgroundCropTarget): string {
  return getPageBackgroundNodeName(key)
}

function isCropSuppressed(key: PageBackgroundCropTarget): boolean {
  return props.cropEditingKey != null && props.cropEditingKey === key
}
</script>
