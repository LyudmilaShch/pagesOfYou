<template>
  <v-rect v-if="ctx.photoRectConfig.value && !ctx.photoUrl.value" :config="ctx.photoRectConfig.value" />

  <v-line
    v-for="(line, index) in ctx.photoIconLines.value"
    :key="`photo-icon-${index}`"
    v-show="ctx.photoRectConfig.value && !ctx.photoUrl.value && ctx.showPhotoEditorChrome.value"
    :config="line"
  />

  <v-text
    v-if="ctx.photoEmptyHintConfig.value && !ctx.photoUrl.value && ctx.showPhotoEditorChrome.value"
    :config="ctx.photoEmptyHintConfig.value"
  />

  <v-rect v-if="ctx.photoDropHighlightConfig.value" :config="ctx.photoDropHighlightConfig.value" />

  <v-group v-if="ctx.photoMaskClipConfig.value" :config="ctx.photoMaskClipConfig.value">
    <v-image
      v-if="ctx.photoImageConfig.value && ctx.loadedImage.value && !ctx.isPhotoCropEditing.value && !ctx.isPhotoDimmed.value"
      ref="photoImageRef"
      :config="{ ...ctx.photoImageConfig.value, image: ctx.loadedImage.value }"
    />
  </v-group>

  <template v-for="(borderNode, index) in ctx.photoBorderDrawNodes.value" :key="`photo-border-${index}`">
    <v-rect v-if="borderNode.node === 'rect'" :config="borderNode.config" />
    <v-line v-else :config="borderNode.config" />
  </template>

  <template v-if="ctx.loadedFrameImage.value">
    <v-image
      v-for="(frameSlice, index) in ctx.frameSliceConfigs.value"
      :key="`photo-frame-${index}`"
      :config="{ ...frameSlice, image: ctx.loadedFrameImage.value, listening: false }"
    />
  </template>

  <v-image
    v-if="ctx.photoRepositionOutsideConfig.value && ctx.loadedImage.value && ctx.isPhotoDimmed.value"
    :config="{ ...ctx.photoRepositionOutsideConfig.value, image: ctx.loadedImage.value }"
  />

  <v-group
    v-if="ctx.photoClipConfig.value && ctx.photoRepositionInsideConfig.value && ctx.loadedImage.value && ctx.isPhotoDimmed.value"
    :config="ctx.photoClipConfig.value"
  >
    <v-image :config="{ ...ctx.photoRepositionInsideConfig.value, image: ctx.loadedImage.value }" />
  </v-group>

  <v-rect v-if="ctx.photoDimBorderConfig.value" :config="ctx.photoDimBorderConfig.value" />
  <v-shape v-if="ctx.photoMaskOutlineConfig.value" :config="ctx.photoMaskOutlineConfig.value" />

  <v-group :config="{ listening: false }">
    <EffectExtraNode
      v-for="(node, index) in ctx.shapeExtraNodesBehind.value"
      :key="`shape-extra-behind-${index}`"
      :spec="node"
    />
  </v-group>

  <v-rect v-if="ctx.shapeRectConfig.value" ref="shapeRectRef" :config="ctx.shapeRectConfig.value" />
  <v-circle v-if="ctx.shapeCircleConfig.value" ref="shapeCircleRef" :config="ctx.shapeCircleConfig.value" />
  <v-line v-if="ctx.shapeLineConfig.value" ref="shapeLineRef" :config="ctx.shapeLineConfig.value" />

  <v-group :config="{ listening: false }">
    <EffectExtraNode
      v-for="(node, index) in ctx.shapeExtraNodesFront.value"
      :key="`shape-extra-front-${index}`"
      :spec="node"
    />
  </v-group>

  <v-rect
    v-if="ctx.textBackgroundConfig.value && !ctx.isEditingText.value"
    :config="ctx.textBackgroundConfig.value"
  />

  <template v-if="ctx.textEchoLayerConfigs.value && !ctx.isEditingText.value">
    <v-text
      v-for="(layer, index) in ctx.textEchoLayerConfigs.value"
      :key="`text-echo-${index}`"
      :config="layer"
    />
  </template>

  <v-text
    v-if="ctx.textConfig.value && !ctx.isEditingText.value"
    :config="ctx.textConfig.value"
  />
</template>

<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue'

import type Konva from 'konva'

import {
  EDITOR_ELEMENT_VISUALS_KEY,
} from './editor-element-visuals.context'
import EffectExtraNode from './EffectExtraNode.vue'

const ctx = inject(EDITOR_ELEMENT_VISUALS_KEY)

if (!ctx) {
  throw new Error('EditorElementVisuals requires EDITOR_ELEMENT_VISUALS_KEY provider')
}

// Konva only applies `filters` to nodes that have been cached — vue-konva doesn't do this for
// us, so re-cache (or drop the cache once no filters are active) whenever the photo's filter
// config or the loaded image itself changes.
const photoImageRef = ref<{ getNode: () => Konva.Image } | null>(null)

watch(
  () => [ctx.photoImageConfig.value, ctx.loadedImage.value],
  async () => {
    await nextTick()
    const node = photoImageRef.value?.getNode?.()
    if (!node) {
      return
    }

    const config = ctx.photoImageConfig.value as { filters?: unknown[]; blurRadius?: number } | null
    const hasFilters = Boolean(config?.filters?.length)

    if (hasFilters) {
      // Blur needs extra canvas around the node's own bounds to spread into — caching with no
      // offset clips the cache buffer exactly to the node's silhouette, so the blur has nowhere
      // to bleed and reads as a no-op.
      node.cache({ offset: Math.ceil(config?.blurRadius ?? 0) + 4 })
    } else if (node.isCached()) {
      node.clearCache()
    }

    node.getLayer()?.batchDraw()
  },
  { deep: true },
)

// Same caching requirement as the photo image above — the 'blur' and 'glass' shape visual
// effects apply a Konva.Filters.Blur pixel filter, which only takes effect on a cached node.
type CacheableNodeRef = { getNode: () => Konva.Node } | null
const shapeRectRef = ref<CacheableNodeRef>(null)
const shapeCircleRef = ref<CacheableNodeRef>(null)
const shapeLineRef = ref<CacheableNodeRef>(null)

watch(
  () => [ctx.shapeRectConfig.value, ctx.shapeCircleConfig.value, ctx.shapeLineConfig.value],
  async () => {
    await nextTick()

    const candidates: Array<[CacheableNodeRef, Record<string, unknown> | null]> = [
      [shapeRectRef.value, ctx.shapeRectConfig.value],
      [shapeCircleRef.value, ctx.shapeCircleConfig.value],
      [shapeLineRef.value, ctx.shapeLineConfig.value],
    ]

    for (const [nodeRef, rawConfig] of candidates) {
      const node = nodeRef?.getNode?.()
      if (!node) {
        continue
      }

      const config = rawConfig as { filters?: unknown[]; blurRadius?: number } | null
      const hasFilters = Boolean(config?.filters?.length)

      if (hasFilters) {
        // See the photo image watcher above — without an offset, the cache buffer is clipped to
        // the shape's own bounds and the blur has no room to spread, so it looks like nothing happened.
        node.cache({ offset: Math.ceil(config?.blurRadius ?? 0) + 4 })
      } else if (node.isCached()) {
        node.clearCache()
      }

      node.getLayer()?.batchDraw()
    }
  },
  { deep: true },
)
</script>
