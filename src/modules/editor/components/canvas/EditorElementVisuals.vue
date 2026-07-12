<template>
  <v-rect v-if="ctx.backgroundRectConfig.value" :config="ctx.backgroundRectConfig.value" />

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

  <v-image
    v-if="ctx.photoImageConfig.value && ctx.loadedImage.value && !ctx.isPhotoCropEditing.value && !ctx.isPhotoDimmed.value"
    :config="{ ...ctx.photoImageConfig.value, image: ctx.loadedImage.value }"
  />

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

  <v-rect v-if="ctx.shapeRectConfig.value" :config="ctx.shapeRectConfig.value" />
  <v-circle v-if="ctx.shapeCircleConfig.value" :config="ctx.shapeCircleConfig.value" />
  <v-line v-if="ctx.shapeLineConfig.value" :config="ctx.shapeLineConfig.value" />

  <v-text
    v-if="ctx.textConfig.value && !ctx.isEditingText.value"
    :config="ctx.textConfig.value"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'

import {
  EDITOR_ELEMENT_VISUALS_KEY,
} from './editor-element-visuals.context'

const ctx = inject(EDITOR_ELEMENT_VISUALS_KEY)

if (!ctx) {
  throw new Error('EditorElementVisuals requires EDITOR_ELEMENT_VISUALS_KEY provider')
}
</script>
