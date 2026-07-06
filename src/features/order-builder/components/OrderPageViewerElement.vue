<template>

  <v-group
    :config="outerGroupConfig"
    @mousedown="handleSelect"
    @touchstart="handleSelect"
    @dblclick="handleDblClick"
    @dbltap="handleDblClick"
  >

    <template v-if="useSpreadSplit">

      <v-group :config="spreadSplitLeftClipConfig">

        <v-group :config="spreadSplitVisualsConfig">

          <EditorElementVisuals />

        </v-group>

      </v-group>

      <v-group :config="spreadSplitRightClipConfig">

        <v-group :config="spreadSplitVisualsConfig">

          <EditorElementVisuals />

        </v-group>

      </v-group>

    </template>



    <v-group :config="innerGroupConfig">

    <v-rect v-if="hitAreaConfig" :config="hitAreaConfig" />



    <v-group v-if="!useSpreadSplit" :config="pageContentClipConfig">

      <EditorElementVisuals />

    </v-group>



    <v-rect v-if="selectionOutlineConfig" :config="selectionOutlineConfig" />

    </v-group>

  </v-group>

</template>



<script setup lang="ts">

import { computed, provide, ref, watch } from 'vue'

import type Konva from 'konva'



import {

  getElementHitAreaConfig,
  getElementInnerGroupConfig,
  getElementOuterGroupConfig,

  getPhotoImageKonvaConfig,

  getPhotoPlaceholderEmptyHintConfig,

  getPhotoPlaceholderIconLines,

  getPhotoPlaceholderRectConfig,

  getShapeCircleConfig,

  getShapeLineConfig,

  getShapeRectConfig,

  getTextConfig,

} from '@/modules/editor/adapters/konva/element-node.adapter'

import EditorElementVisuals from '@/modules/editor/components/canvas/EditorElementVisuals.vue'

import { EDITOR_ELEMENT_VISUALS_KEY } from '@/modules/editor/components/canvas/editor-element-visuals.context'

import type { PageElement } from '@/modules/editor/models'

import {

  getPlaceholderDisplayText,

  getPlaceholderPhotoUrl,

  isPhotoPlaceholderElement,

  isTextPlaceholderElement,

} from '@/modules/editor/utils/placeholder-display.util'

import { applyTextLayoutToElement } from '@/modules/editor/utils/text-auto-size.util'

import { loadHtmlImage } from '@/modules/editor/utils/load-image.util'

import { resolveAssetUrl } from '@/shared/config/assets'

import {

  elementSpansSpreadFold,

  getElementPageClipConfig,

  getSpreadSplitLeftClipConfig,

  getSpreadSplitRightClipConfig,

  getSpreadSplitVisualsConfig,

  spreadLogicalXToVisual,

} from '@/modules/editor/utils/spread.util'

import { mergeElementWithPlaceholderValue } from '../utils/merge-placeholder-element.util'

import { isFillableElement } from '../utils/placeholder.utils'

import type { PlaceholderValue } from '../types/order.types'



const props = defineProps<{

  element: PageElement

  value?: PlaceholderValue

  pageWidth: number

  pageHeight: number

  selected?: boolean

  photoCropActive?: boolean

}>()



const emit = defineEmits<{

  select: [elementId: string]

  'start-text-editing': [elementId: string]

  'request-photo-upload': [elementId: string]

  'start-photo-crop': [elementId: string]

}>()



const loadedImage = ref<HTMLImageElement | null>(null)



const renderElement = computed(() => mergeElementWithPlaceholderValue(props.element, props.value))



const isInteractive = computed(() => isFillableElement(props.element))



const displayText = computed(() =>

  getPlaceholderDisplayText(renderElement.value, props.value?.textValue),

)



const layoutElement = computed(() => {

  if (!isTextPlaceholderElement(renderElement.value)) {

    return renderElement.value

  }



  return applyTextLayoutToElement(

    renderElement.value,

    displayText.value,

    props.pageWidth,

    props.pageHeight,

  )

})



const outerGroupConfig = computed(() => {

  return {

    ...getElementOuterGroupConfig(layoutElement.value),

    x: spreadLogicalXToVisual(
      layoutElement.value.position.x,
      props.pageWidth,
      props.pageHeight,
      layoutElement.value.size.width,
    ),

    y: layoutElement.value.position.y,

    draggable: false,

    listening: isInteractive.value && !props.photoCropActive,

  }

})

const innerGroupConfig = computed(() => {

  const size = {
    width: layoutElement.value.size.width,
    height: Math.max(layoutElement.value.size.height, 1),
  }

  return {

    ...getElementInnerGroupConfig(layoutElement.value),

    x: size.width / 2,

    y: size.height / 2,

    offsetX: size.width / 2,

    offsetY: size.height / 2,

    width: size.width,

    height: size.height,

    rotation: isTextPlaceholderElement(layoutElement.value) ? 0 : layoutElement.value.rotation,

  }

})



const pageContentClipConfig = computed(() =>
  getElementPageClipConfig(
    {
      position: layoutElement.value.position,
      size: layoutElement.value.size,
    },
    props.pageWidth,
    props.pageHeight,
  ),
)



const useSpreadSplit = computed(() =>

  elementSpansSpreadFold(

    {

      position: layoutElement.value.position,

      size: layoutElement.value.size,

      rotation: layoutElement.value.rotation,

    },

    props.pageWidth,

    props.pageHeight,

  ),

)



const spreadSplitVisualsConfig = computed(() =>

  getSpreadSplitVisualsConfig({

    size: layoutElement.value.size,

    rotation: layoutElement.value.rotation,

  }),

)



const spreadSplitLeftClipConfig = computed(() =>

  getSpreadSplitLeftClipConfig(

    {

      position: layoutElement.value.position,

      size: layoutElement.value.size,

    },

    props.pageHeight,

  ),

)



const spreadSplitRightClipConfig = computed(() =>

  getSpreadSplitRightClipConfig(

    {

      position: layoutElement.value.position,

      size: layoutElement.value.size,

    },

    props.pageHeight,

  ),

)



const hitAreaConfig = computed(() => {

  if (!isInteractive.value || props.photoCropActive) {

    return null

  }



  return getElementHitAreaConfig(renderElement.value)

})



const selectionOutlineConfig = computed(() => {

  if (!props.selected || !isInteractive.value || props.photoCropActive) {

    return null

  }



  const bounds =

    renderElement.value.type === 'shape-line'

      ? {

          x: 0,

          y: -8,

          width: Math.max(renderElement.value.size.width, 1),

          height: 16,

        }

      : {

          x: 0,

          y: 0,

          width: renderElement.value.size.width,

          height: Math.max(renderElement.value.size.height, 1),

        }



  return {

    ...bounds,

    stroke: '#111111',

    strokeWidth: 1,

    dash: [4, 4],

    listening: false,

  }

})



const photoUrl = computed(() => {

  if (renderElement.value.type !== 'photo-placeholder') {

    return null

  }



  const url = getPlaceholderPhotoUrl(renderElement.value, props.value?.jsonValue?.url)

  return url ? resolveAssetUrl(url) : null

})



const backgroundRectConfig = computed(() => {

  if (renderElement.value.type !== 'background') {

    return null

  }



  return {

    width: renderElement.value.size.width,

    height: renderElement.value.size.height,

    fill: renderElement.value.color,

    listening: false,

  }

})



const photoRectConfig = computed(() => getPhotoPlaceholderRectConfig(renderElement.value))

const photoIconLines = computed(() => getPhotoPlaceholderIconLines(renderElement.value))

const photoEmptyHintConfig = computed(() => getPhotoPlaceholderEmptyHintConfig(renderElement.value))

const shapeRectConfig = computed(() => getShapeRectConfig(renderElement.value))

const shapeCircleConfig = computed(() => getShapeCircleConfig(renderElement.value))

const shapeLineConfig = computed(() => getShapeLineConfig(renderElement.value))

const textConfig = computed(() => getTextConfig(layoutElement.value, displayText.value))



const photoImageConfig = computed(() => {

  if (!loadedImage.value || renderElement.value.type !== 'photo-placeholder' || props.photoCropActive) {

    return null

  }



  return getPhotoImageKonvaConfig(renderElement.value, loadedImage.value)

})



const isPhotoCropEditing = computed(() => false)

const isPhotoDimmed = computed(() => false)



provide(EDITOR_ELEMENT_VISUALS_KEY, {

  backgroundRectConfig,

  photoRectConfig,

  photoUrl,

  photoIconLines,

  showPhotoEditorChrome: computed(() => true),

  photoEmptyHintConfig,

  photoDropHighlightConfig: computed(() => null),

  photoImageConfig,

  loadedImage,

  isPhotoCropEditing,

  isPhotoDimmed,

  photoRepositionOutsideConfig: computed(() => null),

  photoClipConfig: computed(() => null),

  photoRepositionInsideConfig: computed(() => null),

  photoDimBorderConfig: computed(() => null),

  shapeRectConfig,

  shapeCircleConfig,

  shapeLineConfig,

  textConfig,

  isEditingText: computed(() => false),

})



watch(

  photoUrl,

  async (url) => {

    loadedImage.value = null



    if (!url) {

      return

    }



    try {

      loadedImage.value = await loadHtmlImage(url)

    } catch {

      loadedImage.value = null

    }

  },

  { immediate: true },

)



function handleSelect(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {

  if (!isInteractive.value || props.photoCropActive) {

    return

  }



  event.cancelBubble = true

  emit('select', props.element.id)

}



function handleDblClick(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {

  if (!isInteractive.value) {

    return

  }



  event.cancelBubble = true



  if (isPhotoPlaceholderElement(renderElement.value)) {

    if (photoUrl.value) {

      emit('start-photo-crop', props.element.id)

      return

    }



    emit('request-photo-upload', props.element.id)

    return

  }



  if (isTextPlaceholderElement(renderElement.value)) {

    emit('start-text-editing', props.element.id)

  }

}

</script>

