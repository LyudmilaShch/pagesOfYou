<template>
  <div ref="containerRef" class="template-canvas-preview">
    <v-stage v-if="stageReady" :config="stageConfig">
      <v-layer>
        <v-group :config="pageGroupConfig">
          <v-rect :config="pageBackgroundConfig" />
          <TemplateCanvasPreviewElement
            v-for="element in visibleElements"
            :key="element.id"
            :element="element"
          />
        </v-group>
      </v-layer>
    </v-stage>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import TemplateCanvasPreviewElement from './TemplateCanvasPreviewElement.vue'

const props = defineProps<{
  canvasData: unknown
}>()

const containerRef = ref<HTMLElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })
const stageReady = computed(() => containerSize.value.width > 0 && containerSize.value.height > 0)

let resizeObserver: ResizeObserver | null = null

const canvas = computed(() => normalizeCanvasData(props.canvasData))

const pageWidth = computed(() => canvas.value.pageWidth ?? 595)
const pageHeight = computed(() => canvas.value.pageHeight ?? 842)

const pageScale = computed(() => {
  if (!stageReady.value) {
    return 1
  }

  const padding = 4
  const availableWidth = Math.max(containerSize.value.width - padding * 2, 1)
  const availableHeight = Math.max(containerSize.value.height - padding * 2, 1)

  return Math.min(availableWidth / pageWidth.value, availableHeight / pageHeight.value)
})

const stageConfig = computed(() => ({
  width: containerSize.value.width,
  height: containerSize.value.height,
  listening: false,
}))

const pageGroupConfig = computed(() => {
  const padding = 4
  const scaledWidth = pageWidth.value * pageScale.value
  const scaledHeight = pageHeight.value * pageScale.value

  return {
    x: (containerSize.value.width - scaledWidth) / 2,
    y: (containerSize.value.height - scaledHeight) / 2,
    scaleX: pageScale.value,
    scaleY: pageScale.value,
    listening: false,
  }
})

const pageBackgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: pageWidth.value,
  height: pageHeight.value,
  fill: canvas.value.backgroundColor ?? '#FFFFFF',
  listening: false,
}))

const visibleElements = computed(() =>
  [...canvas.value.elements]
    .filter((element) => element.visible && element.type !== 'background')
    .sort((left, right) => left.zIndex - right.zIndex),
)

function updateContainerSize(): void {
  if (!containerRef.value) {
    return
  }

  containerSize.value = {
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
  }
}

onMounted(() => {
  updateContainerSize()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateContainerSize)
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<style scoped lang="scss">
.template-canvas-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: none;
}
</style>
