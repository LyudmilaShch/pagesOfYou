<template>
  <div
    ref="containerRef"
    class="editor-canvas"
    :class="{ 'editor-canvas--photo-drop': isPhotoFileDragActive }"
    @dragenter.prevent="handlePhotoDragEnter"
    @dragover.prevent="handlePhotoDragOver"
    @dragleave="handlePhotoDragLeave"
    @drop.prevent="handlePhotoDrop"
  >
    <div v-if="store.previewMode" class="editor-canvas__preview-banner">
      <v-icon size="16">mdi-eye-outline</v-icon>
      Режим превью — так страницу увидит пользователь
    </div>

    <div class="editor-canvas__toolbar">
      <v-btn
        icon
        size="x-small"
        :variant="store.snapToGridEnabled ? 'flat' : 'text'"
        :color="store.snapToGridEnabled ? 'primary' : undefined"
        :disabled="store.previewMode"
        title="Привязка к сетке"
        @click="store.toggleSnapToGrid()"
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
        :disabled="store.previewMode || !store.snapToGridEnabled"
        title="Шаг сетки"
      />

      <v-btn
        icon
        size="x-small"
        :variant="store.smartGuidesEnabled ? 'flat' : 'text'"
        :color="store.smartGuidesEnabled ? 'primary' : undefined"
        :disabled="store.previewMode"
        title="Smart guides — центр и края листа"
        @click="store.toggleSmartGuides()"
      >
        <v-icon size="18">mdi-set-square</v-icon>
      </v-btn>

      <v-btn
        icon
        size="x-small"
        :variant="store.printSafeZoneEnabled ? 'flat' : 'text'"
        :color="store.printSafeZoneEnabled ? 'primary' : undefined"
        :disabled="store.previewMode"
        title="Линии безопасности печати — красная зона обрезки и пунктирный отступ"
        @click="store.togglePrintSafeZone()"
      >
        <v-icon size="18">mdi-printer-outline</v-icon>
      </v-btn>

      <span class="editor-canvas__toolbar-divider" aria-hidden="true" />

      <v-btn
        icon
        size="x-small"
        variant="text"
        :disabled="store.previewMode"
        title="Уменьшить (Ctrl + колёсико)"
        @click="store.zoomOut()"
      >
        <v-icon size="18">mdi-minus</v-icon>
      </v-btn>

      <button
        type="button"
        class="editor-canvas__zoom-label"
        :disabled="store.previewMode"
        title="Сбросить масштаб"
        @click="store.resetCanvasZoom()"
      >
        {{ zoomLabel }}
      </button>

      <v-btn
        icon
        size="x-small"
        variant="text"
        :disabled="store.previewMode"
        title="Увеличить (Ctrl + колёсико)"
        @click="store.zoomIn()"
      >
        <v-icon size="18">mdi-plus</v-icon>
      </v-btn>
    </div>

    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleStagePointerDown"
      @touchstart="handleStagePointerDown"
      @mousemove="handleStagePointerMove"
      @mouseup="handleStagePointerUp"
      @touchend="handleStagePointerUp"
      @wheel="handleWheel"
    >
      <v-layer ref="layerRef">
        <v-group :config="pageGroupConfig">
          <template v-if="store.isSpreadPage">
            <v-rect
              v-for="sheet in spreadPageSheets"
              :key="`shadow-${sheet.key}`"
              :config="buildSpreadSheetShadowConfig(sheet, store.backgroundColor)"
            />

            <v-group :config="spreadPageClipConfig">
              <v-rect
                v-for="sheet in spreadPageSheets"
                :key="`bg-${sheet.key}`"
                :config="buildSpreadSheetBackgroundConfig(sheet, store.backgroundColor)"
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

              <v-line :config="spreadFoldLineConfig" />
            </v-group>

            <v-group>
              <EditorElementNode
                v-for="element in store.elements"
                :key="element.id"
                :element="element"
              />
            </v-group>
          </template>

          <template v-else>
            <v-rect :config="pageShadowConfig" />

            <v-group :config="pageClipConfig">
              <v-rect :config="pageBackgroundConfig" />

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
                v-for="element in store.elements"
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

          <v-rect v-if="marqueeRectConfig" :config="marqueeRectConfig" />

          <v-transformer
            v-if="!store.previewMode"
            ref="transformerRef"
            :config="transformerConfig"
            @transform="handleTransformerTransform"
            @transformend="handleTransformerTransformEnd"
          />
        </v-group>
      </v-layer>
    </v-stage>

    <EditorTextEditOverlay
      v-if="!store.previewMode"
      :page-offset="pageOffset"
      :page-scale="pageScale"
    />

    <EditorPhotoCropOverlay
      v-if="!store.previewMode"
      :page-offset="pageOffset"
      :page-scale="pageScale"
    />

    <EditorPrintCropWarning
      v-if="!store.previewMode"
      :visible="store.printCropZoneViolation"
      :page-offset="pageOffset"
      :page-scale="pageScale"
      :page-width="layoutPageWidth"
      allowable
      @allow="store.allowPrintCropViolation()"
    />
  </div>
</template>

<script setup lang="ts">
import type Konva from 'konva'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useEditorStore } from '../../store/editor.store'
import {
  PHOTO_REPOSITION_WHEEL_ZOOM_STEP,
  SNAP_GRID_SIZE_OPTIONS,
} from '../../constants/page.constants'
import {
  buildTransformerChromeConfig,
  getTransformerEnabledAnchors,
} from '../../utils/transformer.util'
import { buildGridLines } from '../../utils/snap.util'
import { buildPrintSafeZoneOverlay } from '../../utils/print-safe-zone.util'
import {
  buildSpreadGridLines,
  buildSpreadSheetBackgroundConfig,
  buildSpreadSheetShadowConfig,
  buildSpreadFoldLineConfig,
  getSpreadPageSheets,
  getSpreadVisualWidth,
  spreadLogicalXToVisual,
  spreadVisualXToLogical,
} from '../../utils/spread.util'
import {
  getElementPivotSize,
  prepareInnerNodeForTransformer,
  readOuterTopLeft,
  resolveElementTransformNode,
} from '../../utils/element-pivot.util'
import {
  buildSmartGuideLineConfigs,
  SMART_GUIDE_STROKE,
} from '../../utils/smart-guides.util'
import {
  isMarqueeLargeEnough,
  normalizeRect,
  stagePointerToPageCoords,
  type PagePointer,
} from '../../utils/marquee-selection.util'
import { isPageBackgroundTarget } from '../../utils/canvas-background.util'
import EditorElementNode from './EditorElementNode.vue'
import EditorTextEditOverlay from './EditorTextEditOverlay.vue'
import EditorPhotoCropOverlay from './EditorPhotoCropOverlay.vue'
import EditorPrintCropWarning from './EditorPrintCropWarning.vue'
import { uploadAdminImage } from '@/shared/api/admin/uploads.api'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'
import {
  clientToPageCoords,
  extractImageFileFromDataTransfer,
  findPhotoPlaceholderAtPoint,
} from '../../utils/photo-drop.util'
import { MIN_TEXT_BOX_WIDTH } from '../../constants/text.constants'
import { getTextMaxWidth } from '../../utils/text-auto-size.util'
import { isTextPlaceholderType } from '../../utils/normalize-text-placeholder.util'
import type { PageElement } from '../../models'

const store = useEditorStore()
const { showErrorMessageModal } = useErrorMessageModal()

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<{ getNode: () => Konva.Stage } | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const isPhotoFileDragActive = ref(false)
const photoDropUploading = ref(false)
let photoDragDepth = 0

const stageSize = ref({ width: 960, height: 720 })

const layoutPageWidth = computed(() =>
  getSpreadVisualWidth(store.pageWidth, store.pageHeight),
)

const spreadPageSheets = computed(() =>
  store.isSpreadPage ? getSpreadPageSheets(store.pageHeight) : [],
)

const spreadPageClipConfig = computed(() => ({
  clip: {
    x: 0,
    y: 0,
    width: layoutPageWidth.value,
    height: store.pageHeight,
  },
}))

const spreadGridLines = computed(() => {
  if (!store.isSpreadPage || !store.snapToGridEnabled || store.previewMode) {
    return []
  }

  return buildSpreadGridLines(store.pageHeight, store.snapGridSize)
})

const spreadFoldLineConfig = computed(() => buildSpreadFoldLineConfig(store.pageHeight))

const fitScale = computed(() => {
  const verticalPadding = 48
  const availableWidth = stageSize.value.width
  const availableHeight = stageSize.value.height - verticalPadding * 2

  return Math.min(
    availableWidth / layoutPageWidth.value,
    availableHeight / store.pageHeight,
    1,
  )
})

const pageScale = computed(() => fitScale.value * store.canvasZoom)

const zoomLabel = computed(() => `${Math.round(store.canvasZoom * 100)}%`)

const gridSizeOptions = SNAP_GRID_SIZE_OPTIONS.map((value) => ({
  title: `${value} px`,
  value,
}))

const gridSizeModel = computed({
  get: () => store.snapGridSize,
  set: (value: number) => store.setSnapGridSize(value),
})

const gridLines = computed(() => {
  if (!store.snapToGridEnabled || store.previewMode) {
    return []
  }

  return buildGridLines(store.pageWidth, store.pageHeight, store.snapGridSize)
})

const printSafeZoneOverlay = computed(() => {
  if (store.previewMode) {
    return { cropRects: [], safeLines: [] }
  }

  const violation = store.printCropZoneViolation
  const guidesEnabled = store.printSafeZoneEnabled

  if (!guidesEnabled && !violation) {
    return { cropRects: [], safeLines: [] }
  }

  const overlay = buildPrintSafeZoneOverlay(
    store.pageWidth,
    store.pageHeight,
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
  buildSmartGuideLineConfigs(store.smartGuideLines, store.pageWidth, store.pageHeight).map(
    (line) => ({
      key: line.key,
      config: {
        points: line.points,
        stroke: SMART_GUIDE_STROKE,
        strokeWidth: 1,
        dash: [4, 4],
        listening: false,
      },
    }),
  ),
)

const smartGuidesGroupConfig = computed(() => ({
  listening: false,
  visible: smartGuideLineConfigs.value.length > 0 && !store.previewMode,
}))

const pageOffset = computed(() => ({
  x: (stageSize.value.width - layoutPageWidth.value * pageScale.value) / 2,
  y: (stageSize.value.height - store.pageHeight * pageScale.value) / 2,
}))

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
    width: store.pageWidth,
    height: store.pageHeight,
  },
}))

const pageShadowConfig = computed(() => ({
  x: 0,
  y: 0,
  width: store.pageWidth,
  height: store.pageHeight,
  fill: store.backgroundColor,
  listening: false,
  shadowColor: 'rgba(17, 17, 17, 0.12)',
  shadowBlur: 24,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowOpacity: 0.35,
}))

const pageBackgroundConfig = computed(() => ({
  name: 'page-background',
  x: 0,
  y: 0,
  width: store.pageWidth,
  height: store.pageHeight,
  fill: store.backgroundColor,
}))

const transformerConfig = computed(() => {
  const isMultiSelection = store.selectedElementIds.length > 1
  const selected = store.selectedElement

  return buildTransformerChromeConfig({
    rotateEnabled: !isMultiSelection && Boolean(selected && !isTextPlaceholderType(selected.type)),
    enabledAnchors: getTransformerEnabledAnchors({
      isMultiSelection,
      isText: Boolean(selected && isTextPlaceholderType(selected.type)),
      isLine: Boolean(selected && selected.type === 'shape-line'),
    }),
    boundBoxFunc: (
      oldBox: { x: number; y: number; width: number; height: number; rotation: number },
      newBox: { x: number; y: number; width: number; height: number; rotation: number },
    ) => {
      if (isMultiSelection) {
        return oldBox
      }

      if (selected && isTextPlaceholderType(selected.type)) {
        const rotationChanged =
          Math.abs(oldBox.rotation - newBox.rotation) > 0.001

        if (rotationChanged) {
          return oldBox
        }

        const maxWidth = getTextMaxWidth(
          selected.position.x,
          store.pageWidth,
          store.pageHeight,
        )
        const boxX = store.isSpreadPage
          ? spreadLogicalXToVisual(
              selected.position.x,
              store.pageWidth,
              store.pageHeight,
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

const marqueeState = ref<{
  active: boolean
  additive: boolean
  start: PagePointer
  current: PagePointer
} | null>(null)

const marqueeRectConfig = computed(() => {
  if (!marqueeState.value?.active) {
    return null
  }

  const rect = normalizeRect(marqueeState.value.start, marqueeState.value.current)

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    fill: 'rgba(17, 17, 17, 0.06)',
    stroke: '#111111',
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  }
})

function getPageGroup(stage: Konva.Stage): Konva.Group | null {
  return stage.findOne('.page-root') as Konva.Group | null
}

function updateStageSize(): void {
  if (!containerRef.value) {
    return
  }

  stageSize.value = {
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
  }
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

function prepareNodeForTransformer(
  node: Konva.Group,
  element: PageElement,
  isMultiSelection: boolean,
): void {
  if (isMultiSelection) {
    return
  }

  const size = getElementPivotSize(
    element.size.width,
    element.size.height,
    element.type === 'shape-line' ? 0 : 1,
  )
  prepareInnerNodeForTransformer(node, size)
}

function getTransformerNodes(): Konva.Node[] {
  return transformerRef.value?.getNode()?.nodes() ?? []
}

function getNodeLogicalPosition(node: Konva.Group): { x: number; y: number } | null {
  const element = store.elements.find((item) => item.id === node.id())

  if (!element) {
    return null
  }

  const topLeft = readOuterTopLeft(node)

  return {
    x: store.isSpreadPage
      ? spreadVisualXToLogical(
          topLeft.x,
          store.pageWidth,
          store.pageHeight,
          element.size.width,
        )
      : topLeft.x,
    y: topLeft.y,
  }
}

function handleTransformerTransform(): void {
  const nodes = getTransformerNodes()

  if (nodes.length <= 1) {
    return
  }

  const livePositions: Record<string, { x: number; y: number }> = {}

  for (const node of nodes) {
    const id = node.id()
    const position = getNodeLogicalPosition(node as Konva.Group)

    if (!id || !position) {
      continue
    }

    livePositions[id] = position
  }

  store.setLiveDragPositions(livePositions)
}

function handleTransformerTransformEnd(): void {
  const nodes = getTransformerNodes()

  if (nodes.length <= 1) {
    store.clearSmartGuideLines()
    return
  }

  store.clearSmartGuideLines()

  const patches = nodes
    .map((node) => {
      const position = getNodeLogicalPosition(node as Konva.Group)

      if (!node.id() || !position) {
        return null
      }

      return {
        id: node.id(),
        position,
      }
    })
    .filter((patch): patch is { id: string; position: { x: number; y: number } } => Boolean(patch))

  store.clearLiveDragPositions(patches.map((patch) => patch.id))
  store.moveElementsPositions(patches)
}

function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (store.previewMode) {
    return
  }

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

  if (!event.evt.shiftKey) {
    store.clearSelection()
  }

  const pageGroup = getPageGroup(stage)
  const pointer = pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null
  if (!pointer) {
    return
  }

  marqueeState.value = {
    active: false,
    additive: event.evt.shiftKey,
    start: pointer,
    current: pointer,
  }
}

function handleStagePointerMove(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (!marqueeState.value) {
    return
  }

  const stage = event.target.getStage()
  const pageGroup = stage ? getPageGroup(stage) : null
  const pointer = stage && pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null

  if (!pointer) {
    return
  }

  marqueeState.value = {
    ...marqueeState.value,
    active: true,
    current: pointer,
  }
}

function handleStagePointerUp(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  if (!marqueeState.value) {
    return
  }

  const stage = event.target.getStage()
  const pageGroup = stage ? getPageGroup(stage) : null
  const pointer = stage && pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null

  if (pointer && marqueeState.value.active) {
    const rect = normalizeRect(marqueeState.value.start, pointer)

    if (isMarqueeLargeEnough(rect)) {
      store.selectElementsInRect(rect, marqueeState.value.additive)
    }
  }

  marqueeState.value = null
}

function getPageGroupFromStage(): Konva.Group | null {
  const stage = stageRef.value?.getNode()
  if (!stage) {
    return null
  }

  return getPageGroup(stage)
}

function updatePhotoDropTarget(clientX: number, clientY: number): void {
  if (store.previewMode || photoDropUploading.value) {
    store.setPhotoDropTarget(null)
    return
  }

  const container = containerRef.value
  const pageGroup = getPageGroupFromStage()

  if (!container || !pageGroup) {
    store.setPhotoDropTarget(null)
    return
  }

  const point = clientToPageCoords(clientX, clientY, container, pageGroup)
  const target = findPhotoPlaceholderAtPoint(store.elements, point)
  store.setPhotoDropTarget(target?.id ?? null)
}

function handlePhotoDragEnter(event: DragEvent): void {
  if (store.previewMode || !extractImageFileFromDataTransfer(event.dataTransfer)) {
    return
  }

  photoDragDepth += 1
  isPhotoFileDragActive.value = true
  updatePhotoDropTarget(event.clientX, event.clientY)
}

function handlePhotoDragOver(event: DragEvent): void {
  if (store.previewMode || !extractImageFileFromDataTransfer(event.dataTransfer)) {
    return
  }

  updatePhotoDropTarget(event.clientX, event.clientY)
}

function handlePhotoDragLeave(): void {
  photoDragDepth = Math.max(0, photoDragDepth - 1)

  if (photoDragDepth === 0) {
    isPhotoFileDragActive.value = false
    store.setPhotoDropTarget(null)
  }
}

async function handlePhotoDrop(event: DragEvent): Promise<void> {
  photoDragDepth = 0
  isPhotoFileDragActive.value = false

  if (store.previewMode || photoDropUploading.value) {
    store.setPhotoDropTarget(null)
    return
  }

  const file = extractImageFileFromDataTransfer(event.dataTransfer)
  const container = containerRef.value
  const pageGroup = getPageGroupFromStage()

  if (!file || !container || !pageGroup) {
    store.setPhotoDropTarget(null)
    return
  }

  const point = clientToPageCoords(event.clientX, event.clientY, container, pageGroup)
  const target = findPhotoPlaceholderAtPoint(store.elements, point)

  store.setPhotoDropTarget(null)

  if (!target) {
    return
  }

  if (store.photoCropEditingElementId) {
    store.stopPhotoCropEditing()
  }

  photoDropUploading.value = true

  try {
    const { url } = await uploadAdminImage(file)
    store.setPhotoImage(target.id, url)
    store.selectElement(target.id)
  } catch (error) {
    showErrorMessageModal(
      getUploadErrorMessage(error),
      'Не удалось загрузить фото',
    )
  } finally {
    photoDropUploading.value = false
  }
}

function handlePhotoRepositionWheel(event: WheelEvent): void {
  const stage = stageRef.value?.getNode()
  const pageGroup = stage ? getPageGroup(stage) : null
  const pointer = stage && pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null
  const step = event.deltaY > 0 ? -PHOTO_REPOSITION_WHEEL_ZOOM_STEP : PHOTO_REPOSITION_WHEEL_ZOOM_STEP

  store.zoomPhotoReposition(step, pointer ?? undefined)
}

function handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
  if (store.previewMode) {
    return
  }

  const nativeEvent = event.evt

  if (store.photoDimElementId) {
    nativeEvent.preventDefault()
    handlePhotoRepositionWheel(nativeEvent)
    return
  }

  if (!nativeEvent.ctrlKey && !nativeEvent.metaKey) {
    return
  }

  nativeEvent.preventDefault()

  if (nativeEvent.deltaY < 0) {
    store.zoomIn()
  } else if (nativeEvent.deltaY > 0) {
    store.zoomOut()
  }
}

async function syncTransformer(): Promise<void> {
  if (store.previewMode || store.liveTransformActive) {
    return
  }

  await nextTick()

  const transformer = transformerRef.value?.getNode()
  const stage = stageRef.value?.getNode()

  if (!transformer || !stage) {
    return
  }

  if (transformer.getActiveAnchor()) {
    return
  }

  if (store.textEditingElementId || store.photoCropEditingElementId || store.photoDimElementId) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
    return
  }

  const selected = store.alignableSelectedElements

  if (selected.length === 0) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
    return
  }

  const isMultiSelection = selected.length > 1
  const nodes: Konva.Group[] = []

  for (const element of selected) {
    const outer = stage.findOne(`#${element.id}`) as Konva.Group | null

    if (!outer) {
      continue
    }

    const node = isMultiSelection
      ? outer
      : resolveElementTransformNode(stage, element.id)

    if (!node) {
      continue
    }

    prepareNodeForTransformer(node, element, isMultiSelection)
    nodes.push(node)
  }

  transformer.nodes(nodes)
  transformer.forceUpdate()
  transformer.getLayer()?.batchDraw()
}

watch(
  () => [
    store.selectedElementIds,
    store.elements,
    store.previewMode,
    store.photoCropEditingElementId,
    store.photoDimElementId,
  ],
  () => {
    void syncTransformer()
  },
  { deep: true },
)

watch(pageScale, () => {
  void syncTransformer()
})

function handleCanvasKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return
  }

  if (store.photoCropEditingElementId) {
    event.preventDefault()
    store.stopPhotoCropEditing()
    return
  }

  if (store.photoDimElementId) {
    event.preventDefault()
    store.stopPhotoDim()
  }
}

onMounted(() => {
  updateStageSize()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateStageSize)
    resizeObserver.observe(containerRef.value)
  }

  window.addEventListener('keydown', handleCanvasKeydown)
  void syncTransformer()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', handleCanvasKeydown)
})
</script>

<style scoped lang="scss">
.editor-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: $bg-tertiary;

  &--photo-drop {
    cursor: copy;
  }
}

.editor-canvas__preview-banner {
  position: absolute;
  top: $spacing-3;
  left: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-4;
  border-radius: $radius-md;
  background: rgba(17, 17, 17, 0.92);
  color: $text-inverse;
  font-size: $font-size-body-sm;
  transform: translateX(-50%);
  pointer-events: none;
}

.editor-canvas__toolbar {
  position: absolute;
  bottom: $spacing-4;
  left: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-1 $spacing-2;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  box-shadow: 0 4px 16px rgba(17, 17, 17, 0.08);
  transform: translateX(-50%);
}

.editor-canvas__toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 $spacing-1;
  background: $border-light;
}

.editor-canvas__grid-size {
  width: 84px;
  flex-shrink: 0;

  :deep(.v-field) {
    font-size: $font-size-caption;
  }

  :deep(.v-field__input) {
    min-height: 28px;
    padding-top: 0;
    padding-bottom: 0;
  }
}

.editor-canvas__zoom-label {
  min-width: 52px;
  padding: 0 $spacing-2;
  border: none;
  background: transparent;
  color: $text-primary;
  font-size: $font-size-body-sm;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
