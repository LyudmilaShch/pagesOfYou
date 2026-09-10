<template>
  <div ref="containerRef" class="spread-thumb">
    <div class="spread-thumb__page" :style="pageStyle">
      <img v-if="canvasData.backgroundImageUrl" class="spread-thumb__bg" :src="canvasData.backgroundImageUrl" alt="" />

      <div
        v-for="leaf in leaves"
        :key="leaf.id"
        class="spread-thumb__el"
        :style="elementStyle(leaf)"
      >
        <img
          v-if="isPhotoElement(leaf) && leaf.defaultImageUrl"
          class="spread-thumb__photo"
          :src="leaf.defaultImageUrl"
          :style="{ borderRadius: `${(leaf.borderRadius ?? 0) * scale}px` }"
          alt=""
        />
        <div v-else-if="isPhotoElement(leaf)" class="spread-thumb__photo-empty" />

        <div v-else-if="isTextElement(leaf)" class="spread-thumb__text" :style="textStyle(leaf)">
          {{ leaf.defaultText }}
        </div>

        <div v-else-if="isShapeElement(leaf)" class="spread-thumb__shape" :style="shapeStyle(leaf)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { CanvasData, LeafElement, ShapeElement, TextPlaceholder } from '../models'
import { isPhotoElement, isShapeElement, isTextElement } from '../models'
import { flattenTree } from '../utils/element-tree.util'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '../constants/page.constants'

const props = defineProps<{ canvasData: CanvasData }>()

const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)

const pageWidth = computed(() => props.canvasData.pageWidth ?? A4_PAGE_WIDTH)
const pageHeight = computed(() => props.canvasData.pageHeight ?? A4_PAGE_HEIGHT)

/** The container keeps whatever box shape the parent gives it (a uniform grid cell, regardless of
 * whether this page is a tall cover or a wide spread); the page itself is fit inside it letterboxed
 * (like `object-fit: contain`) instead of stretching the container to the page's own aspect ratio —
 * otherwise covers/back covers (portrait) tower over spreads (landscape) in the same grid. */
const pageStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${offsetX.value}px`,
  top: `${offsetY.value}px`,
  width: `${pageWidth.value * scale.value}px`,
  height: `${pageHeight.value * scale.value}px`,
  backgroundColor: props.canvasData.backgroundColor ?? '#FFFFFF',
  overflow: 'hidden' as const,
}))

/** `flattenTree` already resolves group nesting into absolute page coordinates, so nested groups
 * need no special handling here — every leaf's `position`/`rotation` is already page-relative. */
const leaves = computed<LeafElement[]>(() =>
  flattenTree(props.canvasData.elements).filter((leaf) => leaf.visible !== false),
)

let observer: ResizeObserver | null = null

function updateScale(): void {
  if (!containerRef.value) {
    return
  }

  const containerWidth = containerRef.value.clientWidth
  const containerHeight = containerRef.value.clientHeight
  const fit = Math.min(containerWidth / pageWidth.value, containerHeight / pageHeight.value)

  scale.value = fit
  offsetX.value = (containerWidth - pageWidth.value * fit) / 2
  offsetY.value = (containerHeight - pageHeight.value * fit) / 2
}

onMounted(() => {
  updateScale()
  observer = new ResizeObserver(() => updateScale())
  if (containerRef.value) {
    observer.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

function elementStyle(leaf: LeafElement): Record<string, string> {
  return {
    position: 'absolute',
    left: `${leaf.position.x * scale.value}px`,
    top: `${leaf.position.y * scale.value}px`,
    width: `${leaf.size.width * scale.value}px`,
    height: `${leaf.size.height * scale.value}px`,
    transform: leaf.rotation ? `rotate(${leaf.rotation}deg)` : '',
    opacity: String(leaf.opacity ?? 1),
    overflow: 'hidden',
  }
}

function textStyle(leaf: TextPlaceholder): Record<string, string> {
  return {
    display: 'flex',
    alignItems: leaf.verticalAlign === 'top' ? 'flex-start' : leaf.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: leaf.textAlign === 'left' ? 'flex-start' : leaf.textAlign === 'right' ? 'flex-end' : 'center',
    fontSize: `${leaf.fontSize * scale.value}px`,
    fontWeight: String(leaf.fontWeight ?? 400),
    fontStyle: leaf.fontItalic ? 'italic' : 'normal',
    color: leaf.color,
    textAlign: leaf.textAlign,
    textTransform: leaf.textTransform === 'uppercase' ? 'uppercase' : 'none',
    lineHeight: String(leaf.lineHeight ?? 1.2),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

function shapeStyle(leaf: ShapeElement): Record<string, string> {
  return {
    width: '100%',
    height: '100%',
    background: leaf.fill,
    border: leaf.strokeWidth ? `${leaf.strokeWidth * scale.value}px solid ${leaf.stroke}` : '',
    borderRadius: leaf.type === 'shape-circle' ? '50%' : `${(leaf.cornerRadius ?? 0) * scale.value}px`,
  }
}
</script>

<style scoped lang="scss">
.spread-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $bg-tertiary;
}

.spread-thumb__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spread-thumb__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.spread-thumb__photo-empty {
  width: 100%;
  height: 100%;
  background: $bg-muted;
}

.spread-thumb__text {
  padding: 0;
}
</style>
