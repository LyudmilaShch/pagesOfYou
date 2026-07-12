<template>
  <div
    ref="containerRef"
    class="order-page-viewer editor-canvas"
    :class="{ 'editor-canvas--photo-drop': isPhotoFileDragActive }"
    @dragenter.prevent="handlePhotoDragEnter"
    @dragover.prevent="handlePhotoDragOver"
    @dragleave="handlePhotoDragLeave"
    @drop.prevent="handlePhotoDrop"
  >
    <div class="editor-canvas__toolbar">
      <v-btn
        icon
        size="x-small"
        :variant="canvasStore.snapToGridEnabled ? 'flat' : 'text'"
        :color="canvasStore.snapToGridEnabled ? 'primary' : undefined"
        title="Привязка к сетке"
        @click="canvasStore.toggleSnapToGrid()"
      >
        <v-icon size="18">mdi-grid</v-icon>
      </v-btn>

      <v-select
        v-model="gridSizeModel"
        :items="gridSizeOptions"
        density="compact"
        variant="outlined"
        hide-details
        class="editor-canvas__grid-size"
        :disabled="!canvasStore.snapToGridEnabled"
        title="Шаг сетки"
      />

      <v-btn
        icon
        size="x-small"
        :variant="canvasStore.smartGuidesEnabled ? 'flat' : 'text'"
        :color="canvasStore.smartGuidesEnabled ? 'primary' : undefined"
        title="Smart guides"
        @click="canvasStore.toggleSmartGuides()"
      >
        <v-icon size="18">mdi-set-square</v-icon>
      </v-btn>

      <v-btn
        icon
        size="x-small"
        :variant="canvasStore.printSafeZoneEnabled ? 'flat' : 'text'"
        :color="canvasStore.printSafeZoneEnabled ? 'primary' : undefined"
        title="Зона безопасности печати"
        @click="canvasStore.togglePrintSafeZone()"
      >
        <v-icon size="18">mdi-printer-outline</v-icon>
      </v-btn>

      <span class="editor-canvas__toolbar-divider" aria-hidden="true" />

      <v-btn icon size="x-small" variant="text" title="Уменьшить" @click="canvasStore.zoomOut()">
        <v-icon size="18">mdi-minus</v-icon>
      </v-btn>

      <button
        type="button"
        class="editor-canvas__zoom-label"
        title="Сбросить масштаб"
        @click="canvasStore.resetCanvasZoom()"
      >
        {{ zoomLabel }}
      </button>

      <v-btn icon size="x-small" variant="text" title="Увеличить" @click="canvasStore.zoomIn()">
        <v-icon size="18">mdi-plus</v-icon>
      </v-btn>
    </div>

    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleStagePointerDown"
      @touchstart="handleStagePointerDown"
      @wheel="handleWheel"
    >
      <v-layer ref="layerRef">
        <v-group :config="pageGroupConfig">
          <template v-if="isSpreadLayout">
            <v-rect
              v-for="sheet in spreadPageSheets"
              :key="`shadow-${sheet.key}`"
              :config="buildSpreadSheetShadowConfig(sheet, getSpreadSheetShadowColor(sheet.key))"
            />

            <v-group :config="spreadPageClipConfig">
              <SpreadPageBackgroundLayers
                :canvas="normalizedCanvas"
                :page-height="pageHeight"
              />

              <v-line
                v-for="line in spreadGridLines"
                :key="line.key"
                :config="{
                  points: line.points,
                  stroke: line.stroke,
                  strokeWidth: line.strokeWidth,
                  listening: false,
                }"
              />
            </v-group>

            <v-group>
              <EditorElementNode
                v-for="element in canvasStore.elements"
                :key="element.id"
                :element="element"
              />
            </v-group>

            <v-line :config="spreadFoldLineConfig" />
          </template>

          <template v-else>
            <v-rect :config="pageShadowConfig" />

            <v-group :config="pageClipConfig">
              <SpreadPageBackgroundLayers
                :canvas="normalizedCanvas"
                :page-height="pageHeight"
              />

              <v-line
                v-for="line in gridLines"
                :key="line.key"
                :config="{
                  points: line.points,
                  stroke: line.stroke,
                  strokeWidth: line.strokeWidth,
                  listening: false,
                }"
              />
            </v-group>

            <v-group>
              <EditorElementNode
                v-for="element in canvasStore.elements"
                :key="element.id"
                :element="element"
              />
            </v-group>
          </template>

          <v-group :config="printSafeZoneGroupConfig">
            <v-rect
              v-for="rect in printSafeZoneOverlay.cropRects"
              :key="rect.key"
              :config="{
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                fill: rect.fill,
                listening: false,
              }"
            />
            <v-line
              v-for="line in printSafeZoneOverlay.safeLines"
              :key="line.key"
              :config="{
                points: line.points,
                stroke: line.stroke,
                strokeWidth: line.strokeWidth,
                dash: line.dash,
                listening: false,
              }"
            />
          </v-group>

          <v-group :config="smartGuidesGroupConfig">
            <v-line
              v-for="line in smartGuideLineConfigs"
              :key="line.key"
              :config="line.config"
            />
          </v-group>

          <v-transformer
            ref="transformerRef"
            :config="transformerConfig"
            @transform="handleTransformerTransform"
            @transformend="handleTransformerTransformEnd"
          />
        </v-group>
      </v-layer>
    </v-stage>

    <EditorTextEditOverlay :page-offset="pageOffset" :page-scale="pageScale" />
    <EditorPhotoCropOverlay :page-offset="pageOffset" :page-scale="pageScale" />
    <EditorPrintCropWarning
      :visible="canvasStore.printCropZoneViolation"
      :page-offset="pageOffset"
      :page-scale="pageScale"
      :page-width="layoutPageWidth"
    />
  </div>
</template>

<script setup lang="ts">
import type Konva from 'konva'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'

import EditorElementNode from '@/modules/editor/components/canvas/EditorElementNode.vue'
import SpreadPageBackgroundLayers from '@/modules/editor/components/canvas/SpreadPageBackgroundLayers.vue'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import EditorPhotoCropOverlay from '@/modules/editor/components/canvas/EditorPhotoCropOverlay.vue'
import EditorPrintCropWarning from '@/modules/editor/components/canvas/EditorPrintCropWarning.vue'
import EditorTextEditOverlay from '@/modules/editor/components/canvas/EditorTextEditOverlay.vue'
import {
  PHOTO_REPOSITION_WHEEL_ZOOM_STEP,
  SNAP_GRID_SIZE_OPTIONS,
} from '@/modules/editor/constants/page.constants'
import {
  getElementPivotSize,
  prepareInnerNodeForTransformer,
  resolveElementTransformNode,
} from '@/modules/editor/utils/element-pivot.util'
import {
  buildTransformerChromeConfig,
  getTransformerEnabledAnchors,
} from '@/modules/editor/utils/transformer.util'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '@/modules/editor/constants/page.constants'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PageElement } from '@/modules/editor/models'
import { isTextPlaceholderType } from '@/modules/editor/utils/normalize-text-placeholder.util'
import { buildGridLines } from '@/modules/editor/utils/snap.util'
import { buildPrintSafeZoneOverlay } from '@/modules/editor/utils/print-safe-zone.util'
import {
  buildSpreadGridLines,
  buildSpreadSheetShadowConfig,
  buildSpreadFoldLineConfig,
  getSpreadPageSheets,
  getSpreadVisualWidth,
  isSpreadCanvas,
  spreadLogicalXToVisual,
} from '@/modules/editor/utils/spread.util'
import {
  buildSmartGuideLineConfigs,
  SMART_GUIDE_STROKE,
} from '@/modules/editor/utils/smart-guides.util'
import {
  clientToPageCoords,
  extractImageFileFromDataTransfer,
  findPhotoPlaceholderAtPoint,
} from '@/modules/editor/utils/photo-drop.util'
import { stagePointerToPageCoords } from '@/modules/editor/utils/marquee-selection.util'
import { isPageBackgroundTarget } from '@/modules/editor/utils/canvas-background.util'
import { MIN_TEXT_BOX_WIDTH } from '@/modules/editor/constants/text.constants'
import { getTextMaxWidth } from '@/modules/editor/utils/text-auto-size.util'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'
import type { OrderFillSession } from '../composables/useOrderFillSession'
import { createOrderCanvasContext } from '../canvas/create-order-canvas-context'
import { ORDER_CANVAS_CONTEXT_KEY } from '../canvas/order-canvas.types'
import { sortElementsByZIndex } from '../utils/placeholder.utils'
import type { PlaceholderValue } from '../types/order.types'

const props = defineProps<{
  fillSession: OrderFillSession
  canvasData: CanvasData
  placeholderValues: PlaceholderValue[]
}>()

const { showErrorMessageModal } = useErrorMessageModal()

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<{ getNode: () => Konva.Stage } | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const stageSize = ref({ width: 640, height: 480 })
const isPhotoFileDragActive = ref(false)
const photoDropUploading = ref(false)
let photoDragDepth = 0

const sortedTemplateElements = computed(() => sortElementsByZIndex(props.canvasData.elements))

const normalizedCanvas = computed(() => normalizeCanvasData(props.canvasData))

const pageWidth = computed(() => normalizedCanvas.value.pageWidth ?? A4_PAGE_WIDTH)
const pageHeight = computed(() => normalizedCanvas.value.pageHeight ?? A4_PAGE_HEIGHT)
const pageBackgroundColor = computed(() => normalizedCanvas.value.backgroundColor ?? '#FFFFFF')

const canvasStore = createOrderCanvasContext(
  props.fillSession,
  sortedTemplateElements,
  pageBackgroundColor,
)

provide(ORDER_CANVAS_CONTEXT_KEY, canvasStore)

const isSpreadLayout = computed(
  () => props.fillSession.isSpreadPage.value || isSpreadCanvas(pageWidth.value, pageHeight.value),
)

const layoutPageWidth = computed(() => getSpreadVisualWidth(pageWidth.value, pageHeight.value))

const spreadPageSheets = computed(() =>
  isSpreadLayout.value ? getSpreadPageSheets(pageHeight.value) : [],
)

function getSpreadSheetShadowColor(sheetKey: 'left' | 'right'): string {
  if (normalizedCanvas.value.spreadBackgroundMode === 'per-page') {
    const sideBackground =
      sheetKey === 'left'
        ? normalizedCanvas.value.leftPageBackground
        : normalizedCanvas.value.rightPageBackground

    return sideBackground?.backgroundColor ?? pageBackgroundColor.value
  }

  return pageBackgroundColor.value
}

const spreadPageClipConfig = computed(() => ({
  clip: {
    x: 0,
    y: 0,
    width: layoutPageWidth.value,
    height: pageHeight.value,
  },
}))

const spreadGridLines = computed(() => {
  if (!isSpreadLayout.value || !canvasStore.snapToGridEnabled) {
    return []
  }

  return buildSpreadGridLines(pageHeight.value, canvasStore.snapGridSize)
})

const spreadFoldLineConfig = computed(() => buildSpreadFoldLineConfig(pageHeight.value))

const fitScale = computed(() => {
  const verticalPadding = 48
  const availableWidth = stageSize.value.width
  const availableHeight = stageSize.value.height - verticalPadding * 2

  return Math.min(
    availableWidth / layoutPageWidth.value,
    availableHeight / pageHeight.value,
    1,
  )
})

const pageScale = computed(() => fitScale.value * canvasStore.canvasZoom)

const pageOffset = computed(() => ({
  x: (stageSize.value.width - layoutPageWidth.value * pageScale.value) / 2,
  y: (stageSize.value.height - pageHeight.value * pageScale.value) / 2,
}))

const zoomLabel = computed(() => `${Math.round(canvasStore.canvasZoom * 100)}%`)

const gridSizeOptions = SNAP_GRID_SIZE_OPTIONS.map((size) => ({
  title: `${size} pt`,
  value: size,
}))

const gridSizeModel = computed({
  get: () => canvasStore.snapGridSize,
  set: (value: number) => {
    canvasStore.snapGridSize = value
  },
})

const stageConfig = computed(() => ({
  width: stageSize.value.width,
  height: stageSize.value.height,
}))

const pageGroupConfig = computed(() => ({
  name: 'page-root',
  x: pageOffset.value.x,
  y: pageOffset.value.y,
  scaleX: pageScale.value,
  scaleY: pageScale.value,
}))

const pageClipConfig = computed(() => ({
  clip: {
    x: 0,
    y: 0,
    width: pageWidth.value,
    height: pageHeight.value,
  },
}))

const pageShadowConfig = computed(() => ({
  x: 0,
  y: 0,
  width: pageWidth.value,
  height: pageHeight.value,
  fill: pageBackgroundColor.value,
  listening: false,
  shadowColor: 'rgba(17, 17, 17, 0.1)',
  shadowBlur: 16,
  shadowOffsetY: 6,
  shadowOpacity: 0.3,
}))

const gridLines = computed(() => {
  if (!canvasStore.snapToGridEnabled) {
    return []
  }

  return buildGridLines(pageWidth.value, pageHeight.value, canvasStore.snapGridSize)
})

const printSafeZoneOverlay = computed(() => {
  const violation = canvasStore.printCropZoneViolation
  const guidesEnabled = canvasStore.printSafeZoneEnabled

  if (!guidesEnabled && !violation) {
    return { cropRects: [], safeLines: [] }
  }

  const overlay = buildPrintSafeZoneOverlay(
    pageWidth.value,
    pageHeight.value,
    undefined,
    undefined,
    violation,
  )

  if (!guidesEnabled) {
    return {
      cropRects: overlay.cropRects,
      safeLines: [],
    }
  }

  return overlay
})

const printSafeZoneGroupConfig = computed(() => ({
  listening: false,
  visible:
    printSafeZoneOverlay.value.cropRects.length > 0 ||
    printSafeZoneOverlay.value.safeLines.length > 0,
}))

const smartGuideLineConfigs = computed(() =>
  buildSmartGuideLineConfigs(canvasStore.smartGuideLines, pageWidth.value, pageHeight.value).map(
    (line) => ({
      key: line.key,
      config: {
        points: line.points,
        stroke: SMART_GUIDE_STROKE,
        strokeWidth: 1,
        listening: false,
      },
    }),
  ),
)

const smartGuidesGroupConfig = computed(() => ({
  listening: false,
  visible: smartGuideLineConfigs.value.length > 0,
}))

const transformerConfig = computed(() => {
  const selected = canvasStore.selectedElement

  return buildTransformerChromeConfig({
    rotateEnabled: Boolean(selected && !isTextPlaceholderType(selected.type)),
    enabledAnchors: getTransformerEnabledAnchors({
      isText: Boolean(selected && isTextPlaceholderType(selected.type)),
      isLine: Boolean(selected && selected.type === 'shape-line'),
    }),
    boundBoxFunc: (
      oldBox: { x: number; y: number; width: number; height: number; rotation: number },
      newBox: { x: number; y: number; width: number; height: number; rotation: number },
    ) => {
      if (selected && isTextPlaceholderType(selected.type)) {
        const rotationChanged =
          Math.abs(oldBox.rotation - newBox.rotation) > 0.001

        if (rotationChanged) {
          return oldBox
        }

        const maxWidth = getTextMaxWidth(
          selected.position.x,
          pageWidth.value,
          pageHeight.value,
        )
        const boxX = isSpreadLayout.value
          ? spreadLogicalXToVisual(
              selected.position.x,
              pageWidth.value,
              pageHeight.value,
              selected.size.width,
            )
          : selected.position.x

        return {
          x: boxX,
          y: selected.position.y,
          width: Math.max(MIN_TEXT_BOX_WIDTH, Math.min(newBox.width, maxWidth)),
          height: selected.size.height,
          rotation: oldBox.rotation,
        }
      }

      if (newBox.width < 8) {
        return oldBox
      }

      return newBox
    },
  })
})

let resizeObserver: ResizeObserver | null = null

function updateStageSize(): void {
  if (!containerRef.value) {
    return
  }

  stageSize.value = {
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
  }
}

function getPageGroup(stage: Konva.Stage): Konva.Group | null {
  return stage.findOne('.page-root') as Konva.Group | null
}

function getPageGroupFromStage(): Konva.Group | null {
  const stage = stageRef.value?.getNode()
  if (!stage) {
    return null
  }

  return getPageGroup(stage)
}

function isEditorElementTarget(target: Konva.Node): boolean {
  let node: Konva.Node | null = target

  while (node) {
    if (node.name() === 'editor-element') {
      return true
    }

    node = node.parent
  }

  return false
}

function prepareNodeForTransformer(node: Konva.Group, element: PageElement): void {
  const size = getElementPivotSize(
    element.size.width,
    element.size.height,
    element.type === 'shape-line' ? 0 : 1,
  )
  prepareInnerNodeForTransformer(node, size)
}

async function syncTransformer(): Promise<void> {
  await nextTick()

  const transformer = transformerRef.value?.getNode()
  const stage = stageRef.value?.getNode()

  if (!transformer || !stage) {
    return
  }

  if (
    canvasStore.textEditingElementId ||
    canvasStore.photoCropEditingElementId ||
    canvasStore.photoDimElementId
  ) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
    return
  }

  const selected = canvasStore.alignableSelectedElements

  if (selected.length === 0) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
    return
  }

  const nodes: Konva.Group[] = []

  for (const element of selected) {
    const node = resolveElementTransformNode(stage, element.id)

    if (!node) {
      continue
    }

    prepareNodeForTransformer(node, element)
    nodes.push(node)
  }

  transformer.nodes(nodes)
  transformer.forceUpdate()
  transformer.getLayer()?.batchDraw()
}

function handleTransformerTransform(): void {
  // single selection only
}

function handleTransformerTransformEnd(): void {
  canvasStore.clearSmartGuideLines()
}

function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const stage = event.target.getStage()
  if (!stage) {
    return
  }

  if (isEditorElementTarget(event.target)) {
    return
  }

  if (!isPageBackgroundTarget(event.target, stage)) {
    return
  }

  canvasStore.clearSelection()
}

function handlePhotoRepositionWheel(event: WheelEvent): void {
  const stage = stageRef.value?.getNode()
  const pageGroup = stage ? getPageGroup(stage) : null
  const pointer = stage && pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null
  const step = event.deltaY > 0 ? -PHOTO_REPOSITION_WHEEL_ZOOM_STEP : PHOTO_REPOSITION_WHEEL_ZOOM_STEP

  canvasStore.zoomPhotoReposition(step, pointer ?? undefined)
}

function handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
  const nativeEvent = event.evt

  if (canvasStore.photoDimElementId) {
    nativeEvent.preventDefault()
    handlePhotoRepositionWheel(nativeEvent)
    return
  }

  if (!nativeEvent.ctrlKey && !nativeEvent.metaKey) {
    return
  }

  nativeEvent.preventDefault()

  if (nativeEvent.deltaY < 0) {
    canvasStore.zoomIn()
  } else if (nativeEvent.deltaY > 0) {
    canvasStore.zoomOut()
  }
}

function updatePhotoDropTarget(clientX: number, clientY: number): void {
  if (photoDropUploading.value) {
    canvasStore.setPhotoDropTarget(null)
    return
  }

  const container = containerRef.value
  const pageGroup = getPageGroupFromStage()

  if (!container || !pageGroup) {
    canvasStore.setPhotoDropTarget(null)
    return
  }

  const point = clientToPageCoords(clientX, clientY, container, pageGroup)
  const target = findPhotoPlaceholderAtPoint(canvasStore.elements, point)
  canvasStore.setPhotoDropTarget(target?.id ?? null)
}

function handlePhotoDragEnter(event: DragEvent): void {
  if (!extractImageFileFromDataTransfer(event.dataTransfer)) {
    return
  }

  photoDragDepth += 1
  isPhotoFileDragActive.value = true
  updatePhotoDropTarget(event.clientX, event.clientY)
}

function handlePhotoDragOver(event: DragEvent): void {
  if (!extractImageFileFromDataTransfer(event.dataTransfer)) {
    return
  }

  updatePhotoDropTarget(event.clientX, event.clientY)
}

function handlePhotoDragLeave(): void {
  photoDragDepth = Math.max(0, photoDragDepth - 1)

  if (photoDragDepth === 0) {
    isPhotoFileDragActive.value = false
    canvasStore.setPhotoDropTarget(null)
  }
}

async function handlePhotoDrop(event: DragEvent): Promise<void> {
  photoDragDepth = 0
  isPhotoFileDragActive.value = false

  if (photoDropUploading.value) {
    canvasStore.setPhotoDropTarget(null)
    return
  }

  const file = extractImageFileFromDataTransfer(event.dataTransfer)
  const container = containerRef.value
  const pageGroup = getPageGroupFromStage()

  if (!file || !container || !pageGroup) {
    canvasStore.setPhotoDropTarget(null)
    return
  }

  const point = clientToPageCoords(event.clientX, event.clientY, container, pageGroup)
  const target = findPhotoPlaceholderAtPoint(canvasStore.elements, point)

  canvasStore.setPhotoDropTarget(null)

  if (!target) {
    return
  }

  if (canvasStore.photoCropEditingElementId) {
    canvasStore.stopPhotoCropEditing()
  }

  photoDropUploading.value = true

  try {
    await props.fillSession.uploadPhoto(target.id, file)
    canvasStore.selectElement(target.id)
  } catch (error) {
    showErrorMessageModal(getUploadErrorMessage(error), 'Не удалось загрузить фото')
  } finally {
    photoDropUploading.value = false
  }
}

watch(
  () => [
    props.fillSession.selectedElementId.value,
    props.fillSession.textEditingElementId.value,
    props.fillSession.photoCropEditingElementId.value,
    canvasStore.photoDimElementId,
  ],
  () => {
    void syncTransformer()
  },
)

watch(
  () => props.placeholderValues,
  () => {
    void syncTransformer()
  },
  { deep: true },
)

onMounted(() => {
  updateStageSize()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateStageSize)
    resizeObserver.observe(containerRef.value)
  }

  void syncTransformer()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<style scoped lang="scss">
.order-page-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  background: $bg-tertiary;
  border-radius: 0;
  overflow: hidden;
}

.editor-canvas__toolbar {
  position: absolute;
  top: $spacing-3;
  left: $spacing-3;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-1;
  border-radius: $radius-md;
  background: rgba($bg-primary, 0.94);
  border: 1px solid $border-light;
  box-shadow: 0 4px 16px rgb(17 17 17 / 8%);
}

.editor-canvas__toolbar-divider {
  width: 1px;
  height: 24px;
  margin-inline: $spacing-1;
  background: $border-light;
}

.editor-canvas__grid-size {
  width: 88px;
}

.editor-canvas__zoom-label {
  min-width: 48px;
  padding: 0 $spacing-1;
  border: none;
  background: transparent;
  font-size: $font-size-caption;
  color: $text-secondary;
  cursor: pointer;
}

.editor-canvas--photo-drop {
  outline: 2px dashed rgba($text-primary, 0.35);
  outline-offset: -4px;
}
</style>
