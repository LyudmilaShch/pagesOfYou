<template>

  <v-group
    ref="outerGroupRef"
    :config="outerGroupConfig"

    @mousedown="handleSelect"

    @touchstart="handleSelect"

    @dragstart="handleDragStart"

    @dragmove="handleDragMove"

    @dragend="handleDragEnd"

    @dblclick="handleDblClick"

    @dbltap="handleDblClick"

  >

    <template v-if="showSpreadSplitVisuals">
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

    <v-group
      ref="transformGroupRef"
      :config="innerGroupShellConfig"
      @transformstart="handleTransformStart"
      @transform="handleTransform"
      @transformend="handleTransformEnd"
    >

    <v-rect v-if="hitAreaConfig" :config="hitAreaConfig" />

    <v-group v-if="showTransformGroupVisuals" :config="transformPreviewClipConfig">
      <EditorElementVisuals />
    </v-group>

    <v-rect v-if="photoRepositionBoundsConfig" :config="photoRepositionBoundsConfig" />

    <v-rect
      v-if="photoRepositionPanHitConfig"
      :config="photoRepositionPanHitConfig"
      @mouseenter="handlePhotoPanHitEnter"
      @mouseleave="handlePhotoPanHitLeave"
      @mousedown="handlePhotoPanPointerDown"
      @touchstart="handlePhotoPanPointerDown"
    />

    <v-rect
      v-if="photoPlaceholderPanHitConfig"
      :config="photoPlaceholderPanHitConfig"
      @mouseenter="handlePhotoPanHitEnter"
      @mouseleave="handlePhotoPanHitLeave"
      @mousedown="handlePhotoPanPointerDown"
      @touchstart="handlePhotoPanPointerDown"
    />

    <v-circle
      v-for="handle in photoScaleHandles"
      :key="`photo-scale-${handle.corner}`"
      :config="handle.config"
      @mouseenter="handlePhotoScaleHandleEnter(handle.corner)"
      @mouseleave="handlePhotoScaleHandleLeave"
      @mousedown="handlePhotoScalePointerDown(handle.corner, $event)"
      @touchstart="handlePhotoScalePointerDown(handle.corner, $event)"
    />

    <v-rect v-if="photoCropBorderConfig" :config="photoCropBorderConfig" />

    <v-rect v-if="selectionOutlineConfig" :config="selectionOutlineConfig" />
    </v-group>
  </v-group>

</template>



<script setup lang="ts">

import type Konva from 'konva'

import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import {
  ORDER_CANVAS_CONTEXT_KEY,
  type OrderCanvasContext,
} from '@/features/order-builder/canvas/order-canvas.types'

import {
  getElementHitAreaConfig,
  getElementOuterGroupConfig,
  getPhotoClipGroupConfig,
  getPhotoCropEditingBorderConfig,
  getPhotoDimBorderConfig,
  getPhotoDropHighlightConfig,
  getPhotoImageKonvaConfig,
  getPhotoPlaceholderEmptyHintConfig,
  getPhotoPlaceholderIconLines,
  getPhotoPlaceholderRectConfig,
  getPhotoRepositionBoundsConfig,
  getPhotoRepositionLayerConfig,
  getPhotoRepositionPanHitConfig,
  getPhotoPlaceholderPanHitConfig,
  getPhotoScaleHandleConfigs,
  getShapeCircleConfig,
  getShapeLineConfig,
  getShapeRectConfig,
  getTextConfig,
} from '../../adapters/konva/element-node.adapter'

import { resolveAssetUrl } from '@/shared/config/assets'

import { MIN_TEXT_BOX_WIDTH } from '../../constants/text.constants'
import {
  PHOTO_DOUBLE_CLICK_MS,
} from '../../constants/page.constants'
import type { PageElement } from '../../models'
import { useElementCanvasStore } from '../../composables/use-element-canvas-store'
import { useEditorStore } from '../../store/editor.store'

import { getPlaceholderDisplayText, getPlaceholderPhotoUrl, isPhotoPlaceholderElement, isTextPlaceholderElement } from '../../utils/placeholder-display.util'
import { loadHtmlImage } from '../../utils/load-image.util'
import { computeSmartGuidesSnap } from '../../utils/smart-guides.util'
import { getTextMaxWidth } from '../../utils/text-auto-size.util'
import {
  elementSpansSpreadFold,
  getElementPageClipConfig,
  getSpreadSplitLeftClipConfig,
  getSpreadSplitRightClipConfig,
  getSpreadSplitVisualsConfig,
  spreadLogicalXToVisual,
  spreadVisualXToLogical,
} from '../../utils/spread.util'
import {
  computePhotoCropFromCornerDrag,
  computePhotoCropFromPanDelta,
  getImagePixelSize,
  getPhotoCropState,
  getPhotoScaleCornerCursor,
  resolvePhotoRenderFitMode,
  type PhotoScaleCorner,
} from '../../utils/photo-crop.util'
import { getPhotoBorderDrawNodes } from '../../utils/element-stroke.util'

import {
  applyOuterTopLeftPosition,
  getElementPivotSize,
  getElementTransformNodeId,
  readOuterTopLeft,
  syncInnerTransformNode,
  type ElementPivotSize,
} from '../../utils/element-pivot.util'
import EditorElementVisuals from './EditorElementVisuals.vue'
import { EDITOR_ELEMENT_VISUALS_KEY } from './editor-element-visuals.context'



const props = defineProps<{

  element: PageElement

}>()



const orderCanvas = inject<OrderCanvasContext | null>(ORDER_CANVAS_CONTEXT_KEY, null)
const editorStore = useEditorStore()
const store = useElementCanvasStore()
const editorRefs = storeToRefs(editorStore)
const photoDimElementId = computed(() =>
  orderCanvas ? orderCanvas.photoDimElementId : editorRefs.photoDimElementId.value,
)
const photoCropEditingElementId = computed(() =>
  orderCanvas ? orderCanvas.photoCropEditingElementId : editorRefs.photoCropEditingElementId.value,
)

const outerGroupRef = ref<{ getNode: () => Konva.Group } | null>(null)
const transformGroupRef = ref<{ getNode: () => Konva.Group } | null>(null)
const loadedImage = ref<HTMLImageElement | null>(null)
const lastPhotoClickAt = ref(0)
const photoRepositionDragOrigin = ref<{
  cropX: number
  cropY: number
  pointerX: number
  pointerY: number
} | null>(null)
const activePhotoScaleCorner = ref<PhotoScaleCorner | null>(null)
const photoScalePointerState = ref<{ corner: PhotoScaleCorner } | null>(null)
const transformAnchor = ref<{ x: number; y: number } | null>(null)
const activeTransformerAnchor = ref<string | null>(null)
const isTransforming = ref(false)
const dragPosition = ref<{ x: number; y: number } | null>(null)
const groupDragSnapshot = ref<Record<string, { x: number; y: number }> | null>(null)

function toVisualX(x: number): number {
  return spreadLogicalXToVisual(x, store.pageWidth, store.pageHeight, props.element.size.width)
}

function toLogicalX(x: number): number {
  return spreadVisualXToLogical(x, store.pageWidth, store.pageHeight, props.element.size.width)
}

function toVisualPosition(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: toVisualX(position.x),
    y: position.y,
  }
}

function toLogicalPosition(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: toLogicalX(position.x),
    y: position.y,
  }
}

function getPivotSize(element: PageElement = props.element): ElementPivotSize {
  return getElementPivotSize(
    element.size.width,
    element.size.height,
    element.type === 'shape-line' ? 0 : 1,
  )
}

function getOuterNode(): Konva.Group | null {
  return outerGroupRef.value?.getNode() ?? null
}

function getTransformNode(): Konva.Group | null {
  return transformGroupRef.value?.getNode() ?? null
}

function getActiveTransformerAnchor(node: Konva.Node): string | null {
  const stage = node.getStage()
  const transformers = stage?.find(
    (item: Konva.Node) => item.getClassName() === 'Transformer',
  ) as Konva.Transformer[] | undefined

  const transformer = transformers?.find((item) => item.nodes().includes(node))
  return transformer?.getActiveAnchor() ?? null
}

function applyOuterPosition(
  outer: Konva.Group,
  topLeft: { x: number; y: number },
): void {
  applyOuterTopLeftPosition(outer, toVisualX(topLeft.x), topLeft.y)
}

function readVisualTopLeftFromOuter(outer: Konva.Group): { x: number; y: number } {
  return readOuterTopLeft(outer)
}

function readLogicalTopLeftFromOuter(outer: Konva.Group): { x: number; y: number } {
  return toLogicalPosition(readVisualTopLeftFromOuter(outer))
}

const displayPosition = computed(() => {
  const livePosition = store.liveDragPositions[props.element.id]

  if (livePosition) {
    return livePosition
  }

  if (dragPosition.value) {
    return dragPosition.value
  }

  return props.element.position
})

const outerGroupConfig = computed(() => ({
  ...getElementOuterGroupConfig(props.element),
  x: toVisualX(displayPosition.value.x),
  y: displayPosition.value.y,
  draggable:
    !props.element.locked &&
    !store.previewMode &&
    !isPhotoCropEditing.value &&
    !isPhotoDimmed.value &&
    !store.textEditingElementId,
}))

const innerGroupShellConfig = {
  id: getElementTransformNodeId(props.element.id),
}

function syncInnerFromElement(rotationDeg = props.element.rotation): void {
  if (isTransforming.value) {
    return
  }

  const inner = getTransformNode()
  if (!inner) {
    return
  }

  syncInnerTransformNode(inner, getPivotSize(), rotationDeg)
}

const pageContentClipConfig = computed(() =>
  getElementPageClipConfig(
    {
      position: displayPosition.value,
      size: props.element.size,
    },
    store.pageWidth,
    store.pageHeight,
  ),
)

const useSpreadSplit = computed(
  () =>
    store.isSpreadPage &&
    elementSpansSpreadFold(
      {
        position: displayPosition.value,
        size: props.element.size,
        rotation: props.element.rotation,
      },
      store.pageWidth,
      store.pageHeight,
    ),
)

/** Split rendering pauses during live transform — visuals move inside the transform group. */
const showSpreadSplitVisuals = computed(() => useSpreadSplit.value && !isTransforming.value)

const showTransformGroupVisuals = computed(
  () => !useSpreadSplit.value || isTransforming.value,
)

const transformPreviewClipConfig = computed(() => {
  if (isTransforming.value && useSpreadSplit.value) {
    return undefined
  }

  return pageContentClipConfig.value
})

const spreadSplitLeftClipConfig = computed(() =>
  getSpreadSplitLeftClipConfig(
    { position: displayPosition.value, size: props.element.size },
    store.pageHeight,
  ),
)

const spreadSplitRightClipConfig = computed(() =>
  getSpreadSplitRightClipConfig(
    { position: displayPosition.value, size: props.element.size },
    store.pageHeight,
  ),
)

const spreadSplitVisualsConfig = computed(() =>
  getSpreadSplitVisualsConfig({
    size: props.element.size,
    rotation: props.element.rotation,
  }),
)

function isActiveGroupDrag(): boolean {
  return (
    store.isMultiSelection &&
    store.isElementSelected(props.element.id) &&
    !props.element.locked
  )
}

function getGroupDragTargets(): Array<{ id: string; x: number; y: number }> {
  return store.alignableSelectedElements.map((element) => ({
    id: element.id,
    x: element.position.x,
    y: element.position.y,
  }))
}



const photoUrl = computed(() => {

  if (props.element.type !== 'photo-placeholder') {

    return null

  }



  const url = getPlaceholderPhotoUrl(props.element, props.element.defaultImageUrl)

  return url ? resolveAssetUrl(url) : null

})



const displayText = computed(() => {
  if (orderCanvas && isTextPlaceholderElement(props.element)) {
    return getPlaceholderDisplayText(props.element, orderCanvas.getTextValue(props.element.id))
  }

  return getPlaceholderDisplayText(props.element)
})

const hitAreaConfig = computed(() => getElementHitAreaConfig(props.element))

const backgroundRectConfig = computed(() => {

  if (props.element.type !== 'background') {

    return null

  }



  return {

    width: props.element.size.width,

    height: props.element.size.height,

    fill: props.element.color,

  }

})



const photoRectConfig = computed(() =>
  getPhotoPlaceholderRectConfig(props.element, {
    showEditorChrome: !store.previewMode,
  }),
)

const photoIconLines = computed(() => getPhotoPlaceholderIconLines(props.element))

const photoEmptyHintConfig = computed(() => getPhotoPlaceholderEmptyHintConfig(props.element))

const photoDropHighlightConfig = computed(() =>
  getPhotoDropHighlightConfig(
    props.element,
    store.photoDropTargetId === props.element.id && !store.previewMode,
  ),
)

const isPhotoCropEditing = computed(
  () => photoCropEditingElementId.value === props.element.id,
)

const isPhotoDimmed = computed(() => photoDimElementId.value === props.element.id)

const photoClipConfig = computed(() => getPhotoClipGroupConfig(props.element))

const photoRepositionOutsideConfig = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return null
  }

  return getPhotoRepositionLayerConfig(props.element, loadedImage.value, 'outside')
})

const photoRepositionPanHitConfig = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return null
  }

  const config = getPhotoRepositionPanHitConfig(props.element, loadedImage.value)

  if (!config) {
    return null
  }

  return {
    ...config,
    listening: !activePhotoScaleCorner.value,
  }
})

const photoPlaceholderPanHitConfig = computed(() => {
  if (props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return null
  }

  const config = getPhotoPlaceholderPanHitConfig(props.element)

  if (!config) {
    return null
  }

  return {
    ...config,
    listening: !activePhotoScaleCorner.value,
  }
})

const photoRepositionInsideConfig = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return null
  }

  return getPhotoRepositionLayerConfig(props.element, loadedImage.value, 'inside')
})

const photoDimBorderConfig = computed(() =>
  getPhotoDimBorderConfig(props.element, isPhotoDimmed.value && Boolean(photoUrl.value)),
)

const photoBorderDrawNodes = computed(() => getPhotoBorderDrawNodes(props.element))

const photoRepositionBoundsConfig = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return null
  }

  return getPhotoRepositionBoundsConfig(props.element, loadedImage.value)
})

const photoScaleHandles = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder' || !isPhotoDimmed.value) {
    return []
  }

  return getPhotoScaleHandleConfigs(props.element, loadedImage.value)
})

const photoCropBorderConfig = computed(() =>
  getPhotoCropEditingBorderConfig(props.element, isPhotoCropEditing.value),
)



const photoImageConfig = computed(() => {
  if (!loadedImage.value || props.element.type !== 'photo-placeholder') {
    return null
  }

  return getPhotoImageKonvaConfig(props.element, loadedImage.value)
})



const shapeRectConfig = computed(() => getShapeRectConfig(props.element))

const shapeCircleConfig = computed(() => getShapeCircleConfig(props.element))

const shapeLineConfig = computed(() => getShapeLineConfig(props.element))

const textConfig = computed(() => getTextConfig(props.element, displayText.value))

const isEditingText = computed(
  () => store.textEditingElementId === props.element.id,
)

provide(EDITOR_ELEMENT_VISUALS_KEY, {
  backgroundRectConfig,
  photoRectConfig,
  photoUrl,
  photoIconLines,
  showPhotoEditorChrome: computed(() => !store.previewMode),
  photoEmptyHintConfig,
  photoDropHighlightConfig,
  photoImageConfig,
  loadedImage,
  isPhotoCropEditing,
  isPhotoDimmed,
  photoRepositionOutsideConfig,
  photoClipConfig,
  photoRepositionInsideConfig,
  photoDimBorderConfig,
  photoBorderDrawNodes,
  shapeRectConfig,
  shapeCircleConfig,
  shapeLineConfig,
  textConfig,
  isEditingText,
})

const isSelected = computed(() => store.isElementSelected(props.element.id))

const showSelectionOutline = computed(
  () =>
    isSelected.value &&
    !store.previewMode &&
    (store.isMultiSelection || props.element.locked),
)

const selectionOutlineConfig = computed(() => {
  const bounds =
    props.element.type === 'shape-line'
      ? {
          x: 0,
          y: -8,
          width: Math.max(props.element.size.width, 1),
          height: 16,
        }
      : {
          x: 0,
          y: 0,
          width: props.element.size.width,
          height: Math.max(props.element.size.height, 1),
        }

  if (!showSelectionOutline.value) {
    return null
  }

  return {
    ...bounds,
    stroke: '#111111',
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  }
})

watch(
  () => [props.element.position.x, props.element.position.y],
  ([x, y]) => {
    if (
      dragPosition.value ||
      store.liveDragPositions[props.element.id] ||
      isTransforming.value
    ) {
      return
    }

    const outer = getOuterNode()
    if (!outer) {
      return
    }

    const visualTopLeft = toVisualPosition({ x, y })
    if (
      Math.abs(outer.x() - visualTopLeft.x) > 0.01 ||
      Math.abs(outer.y() - y) > 0.01
    ) {
      applyOuterPosition(outer, { x, y })
      outer.getLayer()?.batchDraw()
    }
  },
)

watch(
  () => props.element.rotation,
  (rotation) => {
    if (isTransforming.value) {
      return
    }

    syncInnerFromElement(rotation)
  },
)

watch(
  () => [props.element.size.width, props.element.size.height],
  () => {
    if (isTransforming.value) {
      return
    }

    syncInnerFromElement()
  },
  { immediate: true },
)

onMounted(() => {
  nextTick(() => {
    syncInnerFromElement()
  })
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
      if (loadedImage.value && props.element.type === 'photo-placeholder') {
        store.registerPhotoImageDimensions(props.element.id, {
          width: loadedImage.value.naturalWidth,
          height: loadedImage.value.naturalHeight,
        })
      }
      outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
    } catch {
      loadedImage.value = null
    }
  },
  { immediate: true },
)

watch(isPhotoDimmed, (active) => {
  if (!active) {
    resetStageCursor()
  }

  nextTick(() => {
    outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
  })
})

function getStageContainer(): HTMLElement | null {
  return outerGroupRef.value?.getNode()?.getStage()?.container() ?? null
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

function handlePhotoScaleHandleEnter(corner: PhotoScaleCorner): void {
  setStageCursor(getPhotoScaleCornerCursor(corner, props.element.rotation))
}

function handlePhotoScaleHandleLeave(): void {
  if (photoScalePointerState.value) {
    return
  }

  resetStageCursor()
}

function handlePhotoPanHitEnter(): void {
  if (photoScalePointerState.value) {
    return
  }

  setStageCursor('grab')
}

function handlePhotoPanHitLeave(): void {
  if (photoRepositionDragOrigin.value || photoScalePointerState.value) {
    return
  }

  resetStageCursor()
}

function isPhotoRepositionChildTarget(target: Konva.Node): boolean {
  let node: Konva.Node | null = target

  while (node) {
    const name = node.name()

    if (name === 'photo-scale-handle' || name === 'photo-reposition-pan' || name === 'photo-placeholder-pan') {
      return true
    }

    node = node.parent
  }

  return false
}

function tryStartPhotoDimFromClick(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean {
  if (photoDimElementId.value === props.element.id) {
    return false
  }

  if (!isPhotoPlaceholderElement(props.element) || !photoUrl.value) {
    return false
  }

  const now = Date.now()

  if (now - lastPhotoClickAt.value < PHOTO_DOUBLE_CLICK_MS) {
    lastPhotoClickAt.value = 0
    event.cancelBubble = true
    store.startPhotoDim(props.element.id)
    nextTick(() => {
      outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
    })
    return true
  }

  lastPhotoClickAt.value = now
  return false
}

function handleSelect(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (store.previewMode || store.textEditingElementId || photoCropEditingElementId.value) {
    return
  }

  if (isPhotoRepositionChildTarget(event.target)) {
    return
  }

  if (photoDimElementId.value === props.element.id) {
    event.cancelBubble = true
    return
  }

  if (photoDimElementId.value) {
    store.stopPhotoDim()
  }

  if (tryStartPhotoDimFromClick(event)) {
    return
  }

  event.cancelBubble = true

  const nativeEvent = event.evt
  const shiftKey = 'shiftKey' in nativeEvent ? nativeEvent.shiftKey : false

  if (shiftKey) {
    store.toggleElementSelection(props.element.id)
    return
  }

  if (store.isElementSelected(props.element.id) && store.isMultiSelection) {
    return
  }

  store.selectElement(props.element.id)
}

function handleDblClick(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (store.previewMode || props.element.locked) {
    return
  }

  if (isPhotoPlaceholderElement(props.element) && photoUrl.value) {
    event.cancelBubble = true
    lastPhotoClickAt.value = 0
    store.startPhotoDim(props.element.id)
    nextTick(() => {
      outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
    })
    return
  }

  if (isPhotoPlaceholderElement(props.element) && !photoUrl.value && orderCanvas) {
    event.cancelBubble = true
    orderCanvas.promptPhotoUpload(props.element.id)
    return
  }

  if (!isTextPlaceholderElement(props.element)) {
    return
  }

  event.cancelBubble = true
  store.startTextEditing(props.element.id)
}

function stopPhotoPanPointerTracking(): void {
  window.removeEventListener('mousemove', handlePhotoPanPointerMove)
  window.removeEventListener('mouseup', handlePhotoPanPointerUp)
  window.removeEventListener('touchmove', handlePhotoPanPointerMove)
  window.removeEventListener('touchend', handlePhotoPanPointerUp)
}

function applyPhotoPanFromPointer(): void {
  const origin = photoRepositionDragOrigin.value

  if (
    !origin ||
    props.element.type !== 'photo-placeholder' ||
    !loadedImage.value
  ) {
    return
  }

  const local = getPointerInElementLocal()

  if (!local) {
    return
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(loadedImage.value)
  const nextCrop = computePhotoCropFromPanDelta(
    props.element.size.width,
    props.element.size.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(props.element.fitMode),
    {
      cropX: origin.cropX,
      cropY: origin.cropY,
      imageScale: props.element.imageScale ?? 1,
    },
    local.x - origin.pointerX,
    local.y - origin.pointerY,
  )

  store.updatePhotoCrop(props.element.id, nextCrop, { live: true })
}

function handlePhotoPanPointerMove(event: MouseEvent | TouchEvent): void {
  if (!photoRepositionDragOrigin.value) {
    return
  }

  event.preventDefault()
  setStageCursor('grabbing')
  applyPhotoPanFromPointer()
  outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
}

function handlePhotoPanPointerUp(): void {
  if (!photoRepositionDragOrigin.value) {
    return
  }

  photoRepositionDragOrigin.value = null
  stopPhotoPanPointerTracking()
  setStageCursor(isPhotoDimmed.value ? 'grab' : '')
  store.finalizeLiveTransform()
  outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
}

function handlePhotoPanPointerDown(
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
): void {
  if (props.element.type !== 'photo-placeholder' || activePhotoScaleCorner.value) {
    return
  }

  event.cancelBubble = true
  event.evt.preventDefault()

  const local = getPointerInElementLocal()

  if (!local) {
    return
  }

  photoRepositionDragOrigin.value = {
    cropX: props.element.cropX,
    cropY: props.element.cropY,
    pointerX: local.x,
    pointerY: local.y,
  }
  setStageCursor('grabbing')
  stopPhotoPanPointerTracking()
  window.addEventListener('mousemove', handlePhotoPanPointerMove)
  window.addEventListener('mouseup', handlePhotoPanPointerUp)
  window.addEventListener('touchmove', handlePhotoPanPointerMove, { passive: false })
  window.addEventListener('touchend', handlePhotoPanPointerUp)
}

function getPointerInElementLocal(): { x: number; y: number } | null {
  const group = getTransformNode()
  const stage = group?.getStage()
  const pointer = stage?.getPointerPosition()

  if (!group || !pointer) {
    return null
  }

  return group.getAbsoluteTransform().copy().invert().point(pointer)
}

function applyPhotoScaleFromPointer(corner: PhotoScaleCorner): void {
  const local = getPointerInElementLocal()

  if (!local || props.element.type !== 'photo-placeholder' || !loadedImage.value) {
    return
  }

  const { width: imageWidth, height: imageHeight } = getImagePixelSize(loadedImage.value)
  const nextCrop = computePhotoCropFromCornerDrag(
    props.element.size.width,
    props.element.size.height,
    imageWidth,
    imageHeight,
    resolvePhotoRenderFitMode(props.element.fitMode),
    getPhotoCropState(props.element),
    corner,
    local.x,
    local.y,
  )

  store.updatePhotoCrop(props.element.id, nextCrop, { live: true })
}

function stopPhotoScalePointerTracking(): void {
  window.removeEventListener('mousemove', handlePhotoScalePointerMove)
  window.removeEventListener('mouseup', handlePhotoScalePointerUp)
  window.removeEventListener('touchmove', handlePhotoScalePointerMove)
  window.removeEventListener('touchend', handlePhotoScalePointerUp)
}

function handlePhotoScalePointerMove(event: MouseEvent | TouchEvent): void {
  if (!photoScalePointerState.value) {
    return
  }

  event.preventDefault()
  setStageCursor(
    getPhotoScaleCornerCursor(
      photoScalePointerState.value.corner,
      props.element.rotation,
    ),
  )
  applyPhotoScaleFromPointer(photoScalePointerState.value.corner)
  outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
}

function handlePhotoScalePointerUp(): void {
  if (!photoScalePointerState.value) {
    return
  }

  const corner = photoScalePointerState.value.corner
  photoScalePointerState.value = null
  activePhotoScaleCorner.value = null
  stopPhotoScalePointerTracking()
  setStageCursor(getPhotoScaleCornerCursor(corner, props.element.rotation))
  store.finalizeLiveTransform()
  outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
}

function handlePhotoScalePointerDown(
  corner: PhotoScaleCorner,
  event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
): void {
  if (props.element.type !== 'photo-placeholder') {
    return
  }

  event.cancelBubble = true
  event.evt.preventDefault()

  activePhotoScaleCorner.value = corner
  photoScalePointerState.value = { corner }
  setStageCursor(getPhotoScaleCornerCursor(corner, props.element.rotation))
  stopPhotoScalePointerTracking()
  window.addEventListener('mousemove', handlePhotoScalePointerMove)
  window.addEventListener('mouseup', handlePhotoScalePointerUp)
  window.addEventListener('touchmove', handlePhotoScalePointerMove, { passive: false })
  window.addEventListener('touchend', handlePhotoScalePointerUp)
  applyPhotoScaleFromPointer(corner)
  outerGroupRef.value?.getNode()?.getLayer()?.batchDraw()
}



function applySnapToOuter(outer: Konva.Group): void {
  let { x, y } = readLogicalTopLeftFromOuter(outer)
  let snappedX = false
  let snappedY = false

  if (store.smartGuidesEnabled) {
    const result = computeSmartGuidesSnap({
      x,
      y,
      width: props.element.size.width,
      height: props.element.size.height,
      pageWidth: store.pageWidth,
      pageHeight: store.pageHeight,
      otherElements: store.elements,
      excludeId: props.element.id,
    })

    x = result.x
    y = result.y
    snappedX = result.snappedX
    snappedY = result.snappedY

    store.setSmartGuideLines({
      vertical: result.verticalGuides,
      horizontal: result.horizontalGuides,
      spreadSide: result.spreadSide,
    })
  } else {
    store.clearSmartGuideLines()
  }

  if (store.snapToGridEnabled) {
    if (!snappedX) {
      x = store.snapCoordinate(x)
    }
    if (!snappedY) {
      y = store.snapCoordinate(y)
    }
  }

  applyOuterPosition(outer, { x, y })
}

function handleDragStart(event: Konva.KonvaEventObject<DragEvent>): void {
  if (isPhotoRepositionChildTarget(event.target)) {
    return
  }

  dragPosition.value = {
    x: props.element.position.x,
    y: props.element.position.y,
  }

  if (isActiveGroupDrag()) {
    groupDragSnapshot.value = Object.fromEntries(
      getGroupDragTargets().map((target) => [
        target.id,
        toVisualPosition({ x: target.x, y: target.y }),
      ]),
    )
    return
  }

  groupDragSnapshot.value = null
}

function handleDragMove(event: Konva.KonvaEventObject<DragEvent>): void {
  const outer = event.target as Konva.Group
  applySnapToOuter(outer)

  if (groupDragSnapshot.value) {
    const origin = groupDragSnapshot.value[props.element.id]

    if (!origin) {
      return
    }

    const current = readVisualTopLeftFromOuter(outer)
    const deltaX = current.x - origin.x
    const deltaY = current.y - origin.y
    const livePositions: Record<string, { x: number; y: number }> = {}

    for (const [id, startPosition] of Object.entries(groupDragSnapshot.value)) {
      livePositions[id] = {
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY,
      }
    }

    store.setLiveDragPositions(
      Object.fromEntries(
        Object.entries(livePositions).map(([id, position]) => [
          id,
          toLogicalPosition(position),
        ]),
      ),
    )
    dragPosition.value = toLogicalPosition(livePositions[props.element.id])
    return
  }

  const nextPosition = readLogicalTopLeftFromOuter(outer)

  dragPosition.value = nextPosition
  store.setLiveDragPosition(props.element.id, nextPosition)
}

function handleDragEnd(event: Konva.KonvaEventObject<DragEvent>): void {
  const outer = event.target as Konva.Group
  applySnapToOuter(outer)
  store.clearSmartGuideLines()

  if (groupDragSnapshot.value) {
    const origin = groupDragSnapshot.value[props.element.id]

    if (!origin) {
      groupDragSnapshot.value = null
      dragPosition.value = null
      store.clearLiveDragPositions()
      return
    }

    const current = readVisualTopLeftFromOuter(outer)
    const deltaX = current.x - origin.x
    const deltaY = current.y - origin.y
    const patches = Object.entries(groupDragSnapshot.value).map(([id, startPosition]) => ({
      id,
      position: toLogicalPosition({
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY,
      }),
    }))

    groupDragSnapshot.value = null
    dragPosition.value = null
    store.clearLiveDragPositions(patches.map((patch) => patch.id))
    store.moveElementsPositions(patches)
    return
  }

  store.clearLiveDragPosition(props.element.id)

  const nextPosition = readLogicalTopLeftFromOuter(outer)

  dragPosition.value = null

  store.updateElement(props.element.id, {
    position: nextPosition,
  })

  if (isTextPlaceholderElement(props.element)) {
    store.recalculateTextElementSize(props.element.id)
  }
}

function bakeBoxTransformFromNode(
  inner: Konva.Group,
): { width: number; height: number; rotation: number } | null {
  const scaleX = inner.scaleX()
  const scaleY = inner.scaleY()
  const isResizing = Math.abs(scaleX - 1) >= 0.001 || Math.abs(scaleY - 1) >= 0.001

  if (!isResizing) {
    return null
  }

  const baseWidth = inner.width() > 0 ? inner.width() : props.element.size.width
  const baseHeight = inner.height() > 0 ? inner.height() : props.element.size.height
  const minHeight = props.element.type === 'shape-line' ? 0 : 8
  const newWidth = Math.max(8, baseWidth * scaleX)
  const newHeight = Math.max(minHeight, baseHeight * scaleY)
  const rotation = inner.rotation()

  syncInnerTransformNode(inner, { width: newWidth, height: newHeight }, rotation)

  return { width: newWidth, height: newHeight, rotation }
}

function applyTextTransformFromNode(inner: Konva.Group): void {
  const scaleX = inner.scaleX()

  if (Math.abs(scaleX - 1) < 0.001) {
    return
  }

  const outer = getOuterNode()
  if (!outer) {
    return
  }

  const anchor = transformAnchor.value ?? {
    x: props.element.position.x,
    y: props.element.position.y,
  }

  const baseWidth = inner.width() > 0 ? inner.width() : props.element.size.width
  const maxWidth = getTextMaxWidth(anchor.x, store.pageWidth, store.pageHeight)
  const newWidth = Math.max(
    MIN_TEXT_BOX_WIDTH,
    Math.min(baseWidth * scaleX, maxWidth),
  )
  const height = inner.height() > 0 ? inner.height() : props.element.size.height

  syncInnerTransformNode(inner, { width: newWidth, height }, inner.rotation())
  applyOuterPosition(outer, { x: anchor.x, y: anchor.y })

  store.updateElement(
    props.element.id,
    {
      textSizingMode: 'fixed',
      position: {
        x: anchor.x,
        y: anchor.y,
      },
      size: {
        width: newWidth,
      },
      rotation: inner.rotation(),
    },
    { live: true },
  )

  const updated = store.elements.find((item) => item.id === props.element.id)
  if (updated) {
    syncInnerTransformNode(
      inner,
      { width: newWidth, height: updated.size.height },
      inner.rotation(),
    )
  }
}

function handleTransformStart(): void {
  const inner = getTransformNode()
  activeTransformerAnchor.value = inner ? getActiveTransformerAnchor(inner) : null
  isTransforming.value = true

  if (!isTextPlaceholderElement(props.element)) {
    return
  }

  transformAnchor.value = {
    x: props.element.position.x,
    y: props.element.position.y,
  }
}

function handleTransform(event: Konva.KonvaEventObject<Event>): void {
  if (store.isMultiSelection) {
    return
  }

  const inner = event.target as Konva.Group
  const activeAnchor = activeTransformerAnchor.value ?? getActiveTransformerAnchor(inner)
  const isRotationTransform =
    activeAnchor === 'rotater' || Math.abs(inner.rotation() - props.element.rotation) > 0.001
  const scaleX = inner.scaleX()
  const scaleY = inner.scaleY()
  const isResizing = Math.abs(scaleX - 1) >= 0.001 || Math.abs(scaleY - 1) >= 0.001

  if (!isResizing || isRotationTransform) {
    return
  }

  if (isTextPlaceholderElement(props.element)) {
    applyTextTransformFromNode(inner)
  }
}

function handleTransformEnd(event: Konva.KonvaEventObject<Event>): void {
  try {
    if (store.isMultiSelection) {
      return
    }

    const inner = event.target as Konva.Group
    const outer = getOuterNode()
    const activeAnchor = activeTransformerAnchor.value ?? getActiveTransformerAnchor(inner)
    const isText = isTextPlaceholderElement(props.element)
    const isTextRotation =
      isText &&
      (activeAnchor === 'rotater' || Math.abs(inner.rotation() - props.element.rotation) > 0.001)

    if (!outer) {
      return
    }

    store.clearSmartGuideLines()
    store.clearLiveDragPosition(props.element.id)

    const isResizing =
      Math.abs(inner.scaleX() - 1) > 0.001 || Math.abs(inner.scaleY() - 1) > 0.001
    let resizedBox: { width: number; height: number; rotation: number } | null = null

    if (isResizing && !isTextRotation) {
      if (isText) {
        applyTextTransformFromNode(inner)
      } else {
        resizedBox = bakeBoxTransformFromNode(inner)
      }
    }

    inner.scaleX(1)
    inner.scaleY(1)

    const size = getPivotSize()
    if (!isText) {
      size.width = Math.max(8, resizedBox?.width ?? inner.width())
      size.height = Math.max(
        props.element.type === 'shape-line' ? 0 : 8,
        resizedBox?.height ?? inner.height(),
      )
    } else if (isResizing && !isTextRotation) {
      const updated = store.elements.find((item) => item.id === props.element.id)
      if (updated) {
        size.width = updated.size.width
        size.height = updated.size.height
      }
    }

    syncInnerTransformNode(inner, size, isText ? props.element.rotation : inner.rotation())

    let topLeft = readLogicalTopLeftFromOuter(outer)

    if (store.snapToGridEnabled && !isTextRotation) {
      topLeft = {
        x: store.snapCoordinate(topLeft.x),
        y: store.snapCoordinate(topLeft.y),
      }
      applyOuterPosition(outer, topLeft)
    }

    if (isText) {
      store.updateElement(
        props.element.id,
        isResizing && !isTextRotation
          ? {
              textSizingMode: 'fixed',
              position: topLeft,
              size: { width: size.width, height: size.height },
            }
          : {
              position: topLeft,
            },
      )
    } else {
      store.updateElement(props.element.id, {
        position: topLeft,
        size,
        rotation: inner.rotation(),
      })

      if (isPhotoPlaceholderElement(props.element) && resizedBox) {
        store.resetPhotoCropOnResize(props.element.id)
      }
    }

    store.finalizeLiveTransform()
  } finally {
    isTransforming.value = false
    transformAnchor.value = null
    activeTransformerAnchor.value = null
  }
}

onBeforeUnmount(() => {
  stopPhotoPanPointerTracking()
  stopPhotoScalePointerTracking()
  photoRepositionDragOrigin.value = null
  photoScalePointerState.value = null
  activePhotoScaleCorner.value = null
  resetStageCursor()
})

</script>


