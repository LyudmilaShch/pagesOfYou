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

    <div v-if="store.groupEditingBreadcrumb.length > 0" class="editor-canvas__breadcrumb">
      <button type="button" class="editor-canvas__breadcrumb-item" @click="store.exitGroupEditingToRoot()">
        Страница
      </button>
      <template v-for="(group, index) in store.groupEditingBreadcrumb" :key="group.id">
        <v-icon size="14">mdi-chevron-right</v-icon>
        <button
          type="button"
          class="editor-canvas__breadcrumb-item"
          :class="{
            'editor-canvas__breadcrumb-item--current': index === store.groupEditingBreadcrumb.length - 1,
          }"
          @click="
            store.setGroupEditingPath(
              store.groupEditingBreadcrumb.slice(0, index + 1).map((item) => item.id),
            )
          "
        >
          {{ group.name }}
        </button>
      </template>
    </div>

    <div class="editor-canvas__toolbar">
      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="x-small"
            :variant="store.snapToGridEnabled ? 'flat' : 'text'"
            :color="store.snapToGridEnabled ? 'primary' : undefined"
            :disabled="store.previewMode"
            aria-label="Привязка к сетке"
            @click="store.toggleSnapToGrid()"
          >
            <v-icon size="18">mdi-grid</v-icon>
          </v-btn>
        </template>
        Привязка к сетке
      </v-tooltip>

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-select
            v-bind="tooltipProps"
            v-model="gridSizeModel"
            :items="gridSizeOptions"
            density="compact"
            variant="outlined"
            hide-details
            class="editor-canvas__grid-size"
            :disabled="store.previewMode || !store.snapToGridEnabled"
            aria-label="Шаг сетки"
          />
        </template>
        Шаг сетки
      </v-tooltip>

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="x-small"
            :variant="store.smartGuidesEnabled ? 'flat' : 'text'"
            :color="store.smartGuidesEnabled ? 'primary' : undefined"
            :disabled="store.previewMode"
            aria-label="Smart guides — центр и края листа"
            @click="store.toggleSmartGuides()"
          >
            <v-icon size="18">mdi-set-square</v-icon>
          </v-btn>
        </template>
        Smart guides — центр и края листа
      </v-tooltip>

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="x-small"
            :variant="store.printSafeZoneEnabled ? 'flat' : 'text'"
            :color="store.printSafeZoneEnabled ? 'primary' : undefined"
            :disabled="store.previewMode"
            aria-label="Линии безопасности печати — красная зона обрезки и пунктирный отступ"
            @click="store.togglePrintSafeZone()"
          >
            <v-icon size="18">mdi-printer-outline</v-icon>
          </v-btn>
        </template>
        Линии безопасности печати — красная зона обрезки и пунктирный отступ
      </v-tooltip>

      <span class="editor-canvas__toolbar-divider" aria-hidden="true" />

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="x-small"
            variant="text"
            :disabled="store.previewMode"
            aria-label="Уменьшить (Ctrl + колёсико)"
            @click="store.zoomOut()"
          >
            <v-icon size="18">mdi-minus</v-icon>
          </v-btn>
        </template>
        Уменьшить (Ctrl + колёсико)
      </v-tooltip>

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="tooltipProps"
            type="button"
            class="editor-canvas__zoom-label"
            :disabled="store.previewMode"
            aria-label="Сбросить масштаб"
            @click="store.resetCanvasZoom()"
          >
            {{ zoomLabel }}
          </button>
        </template>
        Сбросить масштаб
      </v-tooltip>

      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="x-small"
            variant="text"
            :disabled="store.previewMode"
            aria-label="Увеличить (Ctrl + колёсико)"
            @click="store.zoomIn()"
          >
            <v-icon size="18">mdi-plus</v-icon>
          </v-btn>
        </template>
        Увеличить (Ctrl + колёсико)
      </v-tooltip>
    </div>

    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleStagePointerDown"
      @touchstart="handleStagePointerDown"
      @mousemove="handleStagePointerMove"
      @touchmove="handleStagePointerMove"
      @mouseup="handleStagePointerUp"
      @touchend="handleStagePointerUp"
      @touchcancel="handleStagePointerCancel"
      @wheel="handleWheel"
    >
      <v-layer ref="layerRef">
        <v-group :config="pageGroupConfig">
          <template v-if="store.isSpreadPage">
            <v-rect
              v-for="sheet in spreadPageSheets"
              :key="`shadow-${sheet.key}`"
              :config="buildSpreadSheetShadowConfig(sheet, getSpreadSheetShadowColor(sheet.key))"
            />

            <v-group :config="spreadPageClipConfig">
              <SpreadPageBackgroundLayers
                v-if="renderCanvasData"
                :canvas="renderCanvasData"
                :page-height="store.pageHeight"
                :crop-editing-key="store.pageBackgroundCropEditingKey"
                @background-dblclick="handlePageBackgroundDblClick"
              />
            </v-group>

            <!-- Its own group (not mixed with the background's) — vue-konva's onUpdated z-index
                 resync walks sibling order within a group, and mixing grid lines into the
                 background's own group risked putting them behind it depending on render timing. -->
            <v-group :config="{ listening: false }">
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
                v-for="element in store.elements"
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
                v-if="renderCanvasData"
                :canvas="renderCanvasData"
                :page-height="store.pageHeight"
                :crop-editing-key="store.pageBackgroundCropEditingKey"
                @background-dblclick="handlePageBackgroundDblClick"
              />
            </v-group>

            <v-group :config="{ listening: false }">
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

          <PageBackgroundCropLayer v-if="store.pageBackgroundCropEditing && !store.previewMode" />

          <v-transformer
            v-if="!store.previewMode"
            ref="transformerRef"
            :config="transformerConfig"
            @transformstart="handleTransformerTransformStart"
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
      :layout-page-width="layoutPageWidth"
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

    <div
      v-if="isMobileViewport && store.isSpreadPage"
      class="editor-canvas__spread-dots"
      :style="spreadDotsStyle"
    >
      <button
        v-for="side in (['left', 'right'] as const)"
        :key="side"
        type="button"
        class="editor-canvas__spread-dot"
        :class="{ 'editor-canvas__spread-dot--active': activeSpreadSide === side }"
        :aria-label="side === 'left' ? 'Левая страница' : 'Правая страница'"
        @click="goToSpreadSide(side)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type Konva from 'konva'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useEditorStore } from '../../store/editor.store'
import { useMobileViewport } from '../../composables/use-mobile-viewport'
import {
  A4_PAGE_WIDTH,
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
  buildSpreadSheetShadowConfig,
  buildSpreadFoldLineConfig,
  getSpreadPageSheets,
  getSpreadVisualWidth,
  spreadVisualXToLogical,
  spreadLogicalXToVisual,
} from '../../utils/spread.util'
import type { SpreadPageSide } from '../../utils/spread.util'
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
import { isPageBackgroundCropTransformerTarget, isPageBackgroundTarget } from '../../utils/canvas-background.util'
import type { PageBackgroundCropTarget } from '../../utils/canvas-background.util'
import { findNodeById, getElementAbsoluteBounds } from '../../utils/element-tree.util'
import EditorElementNode from './EditorElementNode.vue'
import SpreadPageBackgroundLayers from './SpreadPageBackgroundLayers.vue'
import PageBackgroundCropLayer from './PageBackgroundCropLayer.vue'
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
const isMobileViewport = useMobileViewport()
const { showErrorMessageModal } = useErrorMessageModal()

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<{ getNode: () => Konva.Stage } | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
/** Captured once per transform gesture — text's `boundBoxFunc` must clamp against a STABLE
 * height, not the live store value: text height is recalculated (line-wrap reflow) on every
 * 'transform' tick as width changes, and feeding that live-changing height back into Konva's own
 * boundBoxFunc created a feedback loop (Konva's resize math got thrown off by its own reference
 * box changing height every tick), which showed up as erratic jitter while dragging a width handle. */
const transformStartSize = ref<{ width: number; height: number } | null>(null)
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

const renderCanvasData = computed(() => store.document?.canvasData ?? null)

function getSpreadSheetShadowColor(sheetKey: 'left' | 'right'): string {
  if (store.spreadBackgroundMode === 'per-page') {
    return sheetKey === 'left'
      ? store.leftPageBackground.backgroundColor
      : store.rightPageBackground.backgroundColor
  }

  return store.backgroundColor
}

function handlePageBackgroundDblClick(layerKey: PageBackgroundCropTarget): void {
  if (store.previewMode) {
    return
  }

  store.startPageBackgroundCropEditing(layerKey)
}

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

// Smaller on mobile — the bottom dock and header already eat most of the viewport height, so
// the generous desktop breathing room (48px above/below) would leave the page looking tiny.
const MOBILE_VERTICAL_PADDING = 12

// The "whole spread, fit to screen" scale/offset — this is where the intro zoom animation
// starts from, so the user briefly sees the full two-page layout before zooming into a side.
const mobileSpreadOverviewScale = computed(() => {
  const availableHeight = stageSize.value.height - MOBILE_VERTICAL_PADDING * 2
  return Math.min(
    stageSize.value.width / layoutPageWidth.value,
    availableHeight / store.pageHeight,
  )
})

const mobileSpreadOverviewX = computed(
  () => (stageSize.value.width - layoutPageWidth.value * mobileSpreadOverviewScale.value) / 2,
)

// Fits the active page PLUS a visible slice of the next one into the screen width — same for
// either side, since both page sheets are the same size (see A4_PAGE_WIDTH). Fitting the page's
// width exactly (1x) read as too tightly zoomed in; showing a real chunk of the neighboring page
// (not just a thin sliver) makes it obviously a spread and gives more breathing room.
//
// The stage has no scroll/pan of its own — whatever doesn't fit vertically at this scale is
// simply unreachable, not just off-screen — so this must also respect the height constraint the
// same way the non-spread mobile fit already does, picking whichever axis is smaller. On a tall
// A4 page that's usually height, which is exactly the point: the WHOLE left page has to fit.
const MOBILE_SPREAD_PEEK_RATIO = 1.25

const mobileSpreadFocusScale = computed(() => {
  const availableHeight = stageSize.value.height - MOBILE_VERTICAL_PADDING * 2
  const widthScale = stageSize.value.width / (A4_PAGE_WIDTH * MOBILE_SPREAD_PEEK_RATIO)
  const heightScale = availableHeight / store.pageHeight

  return Math.min(widthScale, heightScale)
})

function mobileSpreadFocusX(side: SpreadPageSide, scale: number): number {
  const sheet = getSpreadPageSheets(store.pageHeight).find((entry) => entry.key === side)
  return MOBILE_VERTICAL_PADDING - (sheet?.x ?? 0) * scale
}

const activeSpreadSide = ref<SpreadPageSide>('left')

// Animated (not derived) scale/x for a mobile spread — tweened via runSpreadAnimation below,
// both between the two states above on first open, and between left/right on dot navigation.
const animatedSpreadScale = ref(0)
const animatedSpreadX = ref(0)
let spreadIntroPlayed = false

// Shared RAF + ease-out-cubic tween over an arbitrary tuple of numbers — used both for the spread
// intro/pagination animation below and for the item-5 "auto-frame selection" viewport animation.
function tweenValues(from: number[], to: number[], duration: number, onTick: (values: number[]) => void): void {
  const startTime = performance.now()

  function tick(now: number): void {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = 1 - (1 - t) ** 3

    onTick(from.map((value, index) => value + (to[index] - value) * eased))

    if (t < 1) {
      requestAnimationFrame(tick)
    }
  }

  requestAnimationFrame(tick)
}

function runSpreadAnimation(
  fromScale: number,
  fromX: number,
  toScale: number,
  toX: number,
  duration = 550,
): void {
  tweenValues([fromScale, fromX], [toScale, toX], duration, ([scale, x]) => {
    animatedSpreadScale.value = scale
    animatedSpreadX.value = x
  })
}

function goToSpreadSide(side: SpreadPageSide): void {
  if (side === activeSpreadSide.value) {
    return
  }

  // Switching sides always lands on a clean, unpanned/unzoomed framing — otherwise a leftover
  // pinch/pan from the previous side would carry over and the new side wouldn't actually be
  // "focused" the way the animation implies.
  store.resetViewport()

  const scale = mobileSpreadFocusScale.value
  activeSpreadSide.value = side
  runSpreadAnimation(
    animatedSpreadScale.value,
    animatedSpreadX.value,
    scale,
    mobileSpreadFocusX(side, scale),
  )
}

function maybePlaySpreadIntro(): void {
  if (!isMobileViewport.value || !store.isSpreadPage || spreadIntroPlayed) {
    return
  }

  // stageSize starts at a desktop-sized placeholder (see its ref default) until
  // updateStageSize() runs in onMounted — computing the overview/focus values before that
  // measurement lands would snapshot this animation against the wrong container size, and
  // since it's a one-shot imperative tween (not a reactive binding), it would never self-correct
  // afterward. Callers must only invoke this once a real measurement is in.
  if (!containerRef.value || stageSize.value.width !== containerRef.value.clientWidth) {
    return
  }

  spreadIntroPlayed = true
  const targetScale = mobileSpreadFocusScale.value
  animatedSpreadScale.value = mobileSpreadOverviewScale.value
  animatedSpreadX.value = mobileSpreadOverviewX.value
  runSpreadAnimation(
    mobileSpreadOverviewScale.value,
    mobileSpreadOverviewX.value,
    targetScale,
    mobileSpreadFocusX('left', targetScale),
    700,
  )
}

// Covers the document loading asynchronously (store.isSpreadPage flips true after mount).
watch(() => isMobileViewport.value && store.isSpreadPage, maybePlaySpreadIntro)

const fitScale = computed(() => {
  if (isMobileViewport.value && store.isSpreadPage) {
    return animatedSpreadScale.value
  }

  const verticalPadding = isMobileViewport.value ? MOBILE_VERTICAL_PADDING : 48
  const availableWidth = stageSize.value.width
  const availableHeight = stageSize.value.height - verticalPadding * 2

  const rawScale = Math.min(availableWidth / layoutPageWidth.value, availableHeight / store.pageHeight)

  // The 1x cap keeps desktop from ever zooming a page in past its real size; on mobile we want
  // the page to fill the screen at whatever scale that takes.
  return isMobileViewport.value ? rawScale : Math.min(rawScale, 1)
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

const pageOffset = computed(() => {
  // On mobile with a spread, x tracks the animated pan (intro zoom + side navigation) computed
  // above — the full two-page spread is wider than the screen at focus scale, so centering it
  // would push the active side off-screen instead of showing it in full.
  const x =
    isMobileViewport.value && store.isSpreadPage
      ? animatedSpreadX.value
      : (stageSize.value.width - layoutPageWidth.value * pageScale.value) / 2

  // On mobile, anchor the page near the top instead of vertically centering it — when the
  // page's aspect ratio doesn't match the available area, centering splits the leftover space
  // evenly above and below, which reads as a large, wasteful gap under the header. Pinning it to
  // a small fixed top padding lets any leftover space fall below the page instead.
  const y = isMobileViewport.value
    ? MOBILE_VERTICAL_PADDING
    : (stageSize.value.height - store.pageHeight * pageScale.value) / 2

  // viewportPanX/Y are mobile-only pan state (see editor.store.ts) — deliberately never touched
  // on desktop, where there is no pan gesture to produce a non-zero value in the first place.
  return { x: x + store.viewportPanX, y: y + store.viewportPanY }
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

function runViewportPanAnimation(fromX: number, fromY: number, toX: number, toY: number): void {
  tweenValues([fromX, fromY], [toX, toY], 400, ([x, y]) => {
    store.setViewportPan(x, y)
  })
}

// Item 5: once a single element is tap-selected on mobile, bring it into a "comfortable" area of
// the viewport — one not covered by the properties dock that's about to slide up from the bottom.
function frameElementIntoView(id: string): void {
  const bounds = getElementAbsoluteBounds(store.elements, id)
  const visualX = spreadLogicalXToVisual(bounds.x, store.pageWidth, store.pageHeight, bounds.width)

  const scale = pageScale.value
  const offset = pageOffset.value

  const screenLeft = offset.x + visualX * scale
  const screenTop = offset.y + bounds.y * scale
  const screenRight = screenLeft + bounds.width * scale
  const screenBottom = screenTop + bounds.height * scale

  const comfortableLeft = MOBILE_VERTICAL_PADDING
  const comfortableRight = stageSize.value.width - MOBILE_VERTICAL_PADDING
  const comfortableTop = MOBILE_VERTICAL_PADDING
  const comfortableBottom = stageSize.value.height - store.mobileDockOccludedHeight - MOBILE_VERTICAL_PADDING

  const alreadyComfortable =
    screenLeft >= comfortableLeft &&
    screenRight <= comfortableRight &&
    screenTop >= comfortableTop &&
    screenBottom <= comfortableBottom

  if (alreadyComfortable) {
    return
  }

  const targetPanX =
    store.viewportPanX + ((comfortableLeft + comfortableRight) / 2 - (screenLeft + screenRight) / 2)
  const targetPanY =
    store.viewportPanY + ((comfortableTop + comfortableBottom) / 2 - (screenTop + screenBottom) / 2)

  runViewportPanAnimation(store.viewportPanX, store.viewportPanY, targetPanX, targetPanY)
}

// Only reacts to an actual new tap-selection (mobile, single element, outside multi-select mode) —
// setLiveDragPosition/updateElement never touch selectedElementIds, so dragging an already-selected
// element never retriggers this.
watch(
  () => (isMobileViewport.value && !store.multiSelectMode ? store.selectedElementIds[0] ?? null : null),
  (id) => {
    if (id) {
      frameElementIntoView(id)
    }
  },
)

// The pagination dots float at a fixed screen position, but the mobile bottom docks are
// position:fixed with a higher z-index and can cover that same spot — lifting the dots above
// whichever dock is currently open (its live height, reported into the store) keeps them visible
// and out of the way, rather than just raising z-index and letting them sit on top of dock content.
const spreadDotsStyle = computed(() => ({
  bottom: `${10 + store.mobileDockOccludedHeight}px`,
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

const transformerConfig = computed(() => {
  const isMultiSelection = store.selectedElementIds.length > 1
  const selected = store.selectedElement

  return buildTransformerChromeConfig({
    rotateEnabled: !isMultiSelection && Boolean(selected),
    coarseRotationSnap: isShiftRotationSnap.value,
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
        const activeAnchor = transformerRef.value?.getNode()?.getActiveAnchor() ?? null

        // The rotate handle is the one gesture allowed to actually change rotation — let Konva's
        // own newBox through untouched. Every other anchor keeps the rejection below, so a resize
        // drag can never smuggle in an incidental rotation delta.
        if (activeAnchor === 'rotater') {
          return newBox
        }

        const rotationChanged =
          Math.abs(oldBox.rotation - newBox.rotation) > 0.001

        if (rotationChanged) {
          return oldBox
        }

        // oldBox/newBox are in STAGE-ABSOLUTE pixel space — Konva's Transformer always works in
        // absolute coordinates (see _getNodeRect()/node.getAbsoluteTransform() in Konva's own
        // source), which includes the page's own render zoom (pageScale, applied to the group
        // these nodes render inside). MIN_TEXT_BOX_WIDTH/getTextMaxWidth/transformStartSize are
        // page/logical units — comparing them against newBox directly is a unit mismatch: at
        // typical zoom levels it clamps width to a near-constant stage-pixel value regardless of
        // how far the handle is dragged, while position (which passes newBox.x/y through
        // untouched) keeps tracking the mouse — i.e. exactly "moves but doesn't resize".
        const scale = pageScale.value || 1
        const minWidth = MIN_TEXT_BOX_WIDTH * scale
        const height = (transformStartSize.value?.height ?? selected.size.height) * scale

        if (activeAnchor === 'middle-left') {
          // Right edge stays fixed for this anchor. Derive it from Konva's own newBox (already in
          // stage-absolute space) instead of recomputing it from selected.position — mixing the
          // two spaces is what previously made the box drift.
          const rightEdge = newBox.x + newBox.width
          const maxWidth = Math.max(minWidth, rightEdge)
          const width = Math.max(minWidth, Math.min(newBox.width, maxWidth))

          return {
            x: rightEdge - width,
            y: newBox.y,
            width,
            height,
            rotation: oldBox.rotation,
          }
        }

        // 'middle-right' (default): left edge stays fixed — trust Konva's own newBox.x/y, only
        // the width needs clamping to the page bound.
        const maxWidth =
          getTextMaxWidth(selected.position.x, store.pageWidth, store.pageHeight) * scale
        const width = Math.max(minWidth, Math.min(newBox.width, maxWidth))

        return {
          x: newBox.x,
          y: newBox.y,
          width,
          height,
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

// Mobile-only background gesture (one-finger pan / two-finger pinch-zoom). Kept separate from
// marqueeState (desktop-only) rather than unified, since the two gestures are mutually exclusive
// per viewport and mixing them into one state shape would just add unused fields to both branches.
type MobileBackgroundGesture =
  | { mode: 'pending'; startClientX: number; startClientY: number; startPan: { x: number; y: number } }
  | { mode: 'pan'; lastClientX: number; lastClientY: number }
  | { mode: 'pinch'; lastDist: number }

const mobileBackgroundGesture = ref<MobileBackgroundGesture | null>(null)
// Screen px a single touch must travel before "maybe a tap" commits to "this is a pan" — mirrors
// the role of MARQUEE_MIN_SIZE, but in client space (zoom-independent) rather than page space.
const PAN_START_THRESHOLD_PX = 6

function getTouches(evt: MouseEvent | TouchEvent): TouchList | null {
  return 'touches' in evt ? evt.touches : null
}

function touchDistance(touches: TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  )
}

function touchMidpoint(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

function startMobileBackgroundGesture(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  // Crop-editing already returned earlier in handleStagePointerDown; text-edit and photo-dim
  // overlays float above the canvas and own their own gestures while active.
  if (store.textEditingElementId || store.photoDimElementId) {
    return
  }

  const touches = getTouches(event.evt)

  if (touches && touches.length >= 2) {
    mobileBackgroundGesture.value = { mode: 'pinch', lastDist: touchDistance(touches) }
    return
  }

  const point = touches ? touches[0] : (event.evt as MouseEvent)

  mobileBackgroundGesture.value = {
    mode: 'pending',
    startClientX: point.clientX,
    startClientY: point.clientY,
    startPan: { x: store.viewportPanX, y: store.viewportPanY },
  }
}

function applyPinchZoom(dist: number, midClient: { x: number; y: number }): void {
  const gesture = mobileBackgroundGesture.value
  if (!gesture || gesture.mode !== 'pinch' || !containerRef.value || gesture.lastDist <= 0 || dist <= 0) {
    return
  }

  const rect = containerRef.value.getBoundingClientRect()
  const midStage = { x: midClient.x - rect.left, y: midClient.y - rect.top }

  // Anchor math: find the page-local point currently under the fingers' midpoint, apply the zoom
  // step, then solve the pan that puts that same page-local point back under the (possibly moved)
  // midpoint. Recomputing the anchor fresh each frame from the previous frame's actual rendered
  // transform means a drifting midpoint (fingers moving together, not just apart) pans for free.
  const beforeOffset = pageOffset.value
  const beforeScale = pageScale.value
  const anchorPageX = (midStage.x - beforeOffset.x) / beforeScale
  const anchorPageY = (midStage.y - beforeOffset.y) / beforeScale

  const oldPanX = store.viewportPanX
  const oldPanY = store.viewportPanY

  store.setCanvasZoom(store.canvasZoom * (dist / gesture.lastDist))

  const afterScale = pageScale.value
  const desiredX = midStage.x - anchorPageX * afterScale
  const desiredY = midStage.y - anchorPageY * afterScale
  const afterOffset = pageOffset.value // same base as before, still using the old pan

  store.setViewportPan(oldPanX + (desiredX - afterOffset.x), oldPanY + (desiredY - afterOffset.y))
}

function updateMobileBackgroundGesture(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const gesture = mobileBackgroundGesture.value
  if (!gesture) {
    return
  }

  const touches = getTouches(event.evt)

  if (touches && touches.length >= 2) {
    const dist = touchDistance(touches)

    if (gesture.mode !== 'pinch') {
      mobileBackgroundGesture.value = { mode: 'pinch', lastDist: dist }
      return
    }

    applyPinchZoom(dist, touchMidpoint(touches))
    mobileBackgroundGesture.value = { mode: 'pinch', lastDist: dist }
    return
  }

  const point = touches ? touches[0] : (event.evt as MouseEvent)
  const clientX = point.clientX
  const clientY = point.clientY

  if (gesture.mode === 'pinch') {
    // Dropped from two touches to one/zero mid-gesture — continue as a pan rather than re-arming
    // the tap threshold, since a multi-touch gesture has already committed to "not a tap".
    mobileBackgroundGesture.value = { mode: 'pan', lastClientX: clientX, lastClientY: clientY }
    return
  }

  if (gesture.mode === 'pending') {
    const dx = clientX - gesture.startClientX
    const dy = clientY - gesture.startClientY

    if (Math.hypot(dx, dy) < PAN_START_THRESHOLD_PX) {
      return
    }

    store.setViewportPan(gesture.startPan.x + dx, gesture.startPan.y + dy)
    mobileBackgroundGesture.value = { mode: 'pan', lastClientX: clientX, lastClientY: clientY }
    return
  }

  store.setViewportPan(
    store.viewportPanX + (clientX - gesture.lastClientX),
    store.viewportPanY + (clientY - gesture.lastClientY),
  )
  mobileBackgroundGesture.value = { mode: 'pan', lastClientX: clientX, lastClientY: clientY }
}

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
  const element = findNodeById(store.elements, node.id())

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

function handleTransformerTransformStart(): void {
  const selected = store.selectedElement
  transformStartSize.value = selected ? { width: selected.size.width, height: selected.size.height } : null
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

  if (store.pageBackgroundCropEditing) {
    if (isPageBackgroundCropTransformerTarget(event.target)) {
      return
    }

    store.stopPageBackgroundCropEditing()
  }

  if (isEditorElementTarget(event.target)) {
    return
  }

  if (!isPageBackgroundTarget(event.target, stage)) {
    return
  }

  if (!event.evt.shiftKey) {
    store.clearSelection()
    store.exitGroupEditingToRoot()

    // A background tap while building a mobile multi-selection should close the action bar
    // outright, not leave it hanging open showing "Выбрано: 0" (clearSelection alone drops the
    // count but multiSelectMode stays on, so the bar's root condition still holds).
    if (store.multiSelectMode) {
      store.exitMultiSelectMode()
    }

    // On mobile, an empty-canvas tap should land on the base rail dock (Фото/Текст/.../Страница),
    // not jump straight into page properties — that's reached explicitly via its own menu item now.
    if (!isMobileViewport.value) {
      store.requestPageProperties()
    }
  }

  // On mobile, background drag means "pan the viewport", not "drag a marquee rectangle" — the two
  // can't share one gesture, and mobile multi-select is already tap-to-toggle (EditorMobileMultiSelectBar),
  // not drag-a-rectangle, so nothing is lost by skipping marqueeState here.
  if (isMobileViewport.value) {
    startMobileBackgroundGesture(event)
    return
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
  if (mobileBackgroundGesture.value) {
    updateMobileBackgroundGesture(event)
    return
  }

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
  if (mobileBackgroundGesture.value) {
    const touches = getTouches(event.evt)

    // touchend fires per lifted finger — if others remain, this is a pinch dropping to a pan, not
    // the end of the whole gesture (the next touchmove would otherwise never get a chance to make
    // that transition, since it only fires once a gesture is already active).
    if (touches && touches.length > 0) {
      mobileBackgroundGesture.value = {
        mode: 'pan',
        lastClientX: touches[0].clientX,
        lastClientY: touches[0].clientY,
      }
      return
    }

    mobileBackgroundGesture.value = null
    return
  }

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

function handleStagePointerCancel(): void {
  mobileBackgroundGesture.value = null
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
  const target = findPhotoPlaceholderAtPoint(store.flatElements, point)
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
  const target = findPhotoPlaceholderAtPoint(store.flatElements, point)

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

function handlePageBackgroundCropWheel(event: WheelEvent): void {
  const stage = stageRef.value?.getNode()
  const pageGroup = stage ? getPageGroup(stage) : null
  const pointer = stage && pageGroup ? stagePointerToPageCoords(stage, pageGroup) : null
  const step = event.deltaY > 0 ? -PHOTO_REPOSITION_WHEEL_ZOOM_STEP : PHOTO_REPOSITION_WHEEL_ZOOM_STEP

  store.zoomPageBackgroundCrop(step, pointer ?? undefined)
}

function handleWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
  if (store.previewMode) {
    return
  }

  const nativeEvent = event.evt

  if (store.pageBackgroundCropEditing) {
    nativeEvent.preventDefault()
    handlePageBackgroundCropWheel(nativeEvent)
    return
  }

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

  if (store.textEditingElementId || store.photoCropEditingElementId || store.pageBackgroundCropEditing || store.photoDimElementId) {
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
    store.pageBackgroundCropEditing,
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

const isShiftRotationSnap = ref(false)

function handleRotationSnapKeydown(event: KeyboardEvent): void {
  if (event.key === 'Shift') {
    isShiftRotationSnap.value = true
  }
}

function handleRotationSnapKeyup(event: KeyboardEvent): void {
  if (event.key === 'Shift') {
    isShiftRotationSnap.value = false
  }
}

function resetRotationSnap(): void {
  isShiftRotationSnap.value = false
}

function handleCanvasKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return
  }

  if (store.photoCropEditingElementId || store.pageBackgroundCropEditing) {
    event.preventDefault()
    store.stopPhotoCropEditing()
    store.stopPageBackgroundCropEditing()
    return
  }

  if (store.photoDimElementId) {
    event.preventDefault()
    store.stopPhotoDim()
    return
  }

  if (store.groupEditingId) {
    event.preventDefault()
    store.exitGroupEditingLevel()
  }
}

onMounted(() => {
  updateStageSize()
  maybePlaySpreadIntro()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateStageSize)
    resizeObserver.observe(containerRef.value)
  }

  window.addEventListener('keydown', handleCanvasKeydown)
  window.addEventListener('keydown', handleRotationSnapKeydown)
  window.addEventListener('keyup', handleRotationSnapKeyup)
  window.addEventListener('blur', resetRotationSnap)
  void syncTransformer()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', handleCanvasKeydown)
  window.removeEventListener('keydown', handleRotationSnapKeydown)
  window.removeEventListener('keyup', handleRotationSnapKeyup)
  window.removeEventListener('blur', resetRotationSnap)
})
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: $bg-primary;

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

.editor-canvas__breadcrumb {
  position: absolute;
  top: $spacing-3;
  left: $spacing-3;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-1 $spacing-2;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  box-shadow: 0 4px 16px rgba(17, 17, 17, 0.08);
  font-size: $font-size-caption;
  color: $text-secondary;
}

.editor-canvas__breadcrumb-item {
  border: none;
  background: transparent;
  padding: 2px 4px;
  border-radius: $radius-sm;
  color: $text-secondary;
  cursor: pointer;

  &:hover {
    background: $state-hover-bg;
    color: $text-primary;
  }

  &--current {
    color: $text-primary;
    font-weight: $font-weight-medium;
  }
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

.editor-canvas__spread-dots {
  position: absolute;
  left: 50%;
  // bottom is set inline (spreadDotsStyle) — it tracks whichever mobile dock is currently open.
  transform: translateX(-50%);
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(13, 13, 13, 0.55);
  backdrop-filter: blur(2px);
}

.editor-canvas__spread-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease;

  &--active {
    background: pp.$accent;
    transform: scale(1.3);
  }
}
</style>
