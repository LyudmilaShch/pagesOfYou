import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'

import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SNAP_GRID_SIZE,
} from '../constants/page.constants'
import { DEFAULT_PAGE_BACKGROUND_IMAGE_FIT, DEFAULT_SPREAD_BACKGROUND_MODE } from '../models/page-background.model'
import type {
  PageBackgroundImageFit,
  PageBackgroundSettings,
  SpreadBackgroundMode,
  SpreadBackgroundSide,
} from '../models/page-background.model'
import {
  createDefaultPageBackgroundSettings,
  getPageBackgroundCropState,
  normalizePageBackgroundSettings,
  normalizeSpreadBackgroundMode,
} from '../models/page-background.model'
import {
  createPerPageBackgroundsFromRoot,
  getRootPageBackgroundSettings,
} from '../utils/spread-background.util'
import {
  getPageCenterPosition,
  snapCoordinate as snapCoordinateUtil,
  snapPosition as snapPositionUtil,
} from '../utils/snap.util'
import type { SmartGuideLines } from '../utils/smart-guides.util'
import { hasElementsInPrintCropZone, elementIntersectsPrintCropZone } from '../utils/print-safe-zone.util'
import {
  computeMultiElementAlignment,
  distributeWithFixedHorizontalGap,
  distributeWithFixedVerticalGap,
  rectsIntersect,
  type MultiAlignMode,
} from '../utils/align-elements.util'
import { isSelectableEditorElement } from '../utils/element-bounds.util'
import { createElementFromLibrary } from '../factories/create-element.factory'
import type { LibraryElementType } from '../factories/create-element.factory'
import { toStoredAssetPath } from '@/shared/config/assets'
import type { PageElement } from '../models'
import { isAiTextElement, isGroupElement, isTextElement } from '../models'
import type { AiTextPlaceholder } from '../models/ai-text-placeholder.model'
import type { GroupElement } from '../models/group-element.model'
import type { ListLayoutMode, ListSettings, ListTextLimit } from '../models/list.model'
import type { ListRole } from '../models/text-placeholder.model'
import { collectLists, type ListInfo } from '../utils/list-distribution.util'
import {
  generateAiTextChainId,
  getAiTextChainParts,
  getAiTextSiblingParts,
  type AiTextSharedPatch,
} from '../utils/ai-text-chain.util'
import type { EditorDocument, EditorSourceDocument } from '../models/page-template.model'
import { normalizeCanvasData } from '../models/canvas-data.model'
import type { CanvasData } from '../models/canvas-data.model'
import type { Position, Size } from '../models/geometry.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import type { PhotoFrameRef, PhotoPlaceholder } from '../models/photo-placeholder.model'
import { isSpreadPageType } from '../utils/spread.util'
import { isTextPlaceholderType } from '../utils/normalize-text-placeholder.util'
import {
  recalculateTextLayout,
  shouldRecalculateTextLayout,
} from '../utils/text-layout.util'
import { positionForTopLeftAnchor } from '../utils/text-auto-size.util'
import { fitFontSizeToBox } from '../utils/text-fit-font.util'
import { measureKonvaText } from '../utils/text-measure.util'
import { resolveTextContent } from '../adapters/konva/element-node.adapter'
import {
  clampPhotoCrop,
  computePhotoCropZoomAtPoint,
  getPhotoCropState,
  pagePointToPhotoLocal,
  resolvePhotoRenderFitMode,
  type PhotoCropState,
} from '../utils/photo-crop.util'
import { getPhotoRenderBox } from '../utils/photo-frame.util'
import {
  absoluteToLocal,
  childBoxFromLocal,
  cloneSubtree,
  contentFrameOf,
  countDescendants,
  findNodeById,
  flattenTree,
  generateElementId,
  getAbsoluteTransform,
  getAncestors,
  getContentFrameOf,
  getDescendants,
  getElementAbsoluteBounds,
  locateNode,
  walkTree,
  type AbsoluteBox,
  type TreeLocation,
} from '../utils/element-tree.util'

export type ElementPatch = {
  position?: Partial<Position>
  size?: Partial<Size>
} & Record<string, unknown>

export interface UpdateElementOptions {
  live?: boolean
  /** Skips the automatic text re-measure/re-wrap this patch would otherwise trigger — for callers
   * that already know they'll request it again shortly (e.g. once per animation tick during a
   * live text resize) and don't need the result until a later, final call. Re-measuring rebuilds a
   * throwaway Konva.Text node to compute wrapping, which is too expensive to redo on every tick. */
  skipTextLayoutRecalc?: boolean
}

export interface PageSettingsPatch {
  width?: number
  height?: number
  backgroundColor?: string
  backgroundImageUrl?: string | null
  backgroundImageFit?: PageBackgroundImageFit
  backgroundImageCropX?: number
  backgroundImageCropY?: number
  backgroundImageScale?: number
  spreadBackgroundMode?: SpreadBackgroundMode
}

type PageBackgroundEditTarget = 'spread' | SpreadBackgroundSide

interface CanvasSnapshot {
  width: number
  height: number
  backgroundColor: string
  backgroundImageUrl: string | null
  backgroundImageFit: PageBackgroundImageFit
  backgroundImageCropX: number
  backgroundImageCropY: number
  backgroundImageScale: number
  spreadBackgroundMode: SpreadBackgroundMode
  leftPageBackground: PageBackgroundSettings
  rightPageBackground: PageBackgroundSettings
  elements: PageElement[]
}

const MAX_HISTORY = 50
const HISTORY_DEBOUNCE_MS = 500
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

export const useEditorStore = defineStore('editor', () => {
  const document = ref<EditorDocument | null>(null)
  const selectedElementIds = ref<string[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const isDirty = ref(false)
  const previewMode = ref(false)
  /** Template editor grows the box downward. The journal editor keeps the frame and shrinks the
   * font so a customer's answer fits the box the template drew. */
  const textFitMode = ref<'grow' | 'shrink'>('grow')
  const canvasZoom = ref(1)
  // Viewport state (mobile pan/pinch-zoom) — sibling to canvasZoom, deliberately never part of
  // CanvasSnapshot/history: pan/zoom describe how the user is looking at the document, not the
  // document itself.
  const viewportPanX = ref(0)
  const viewportPanY = ref(0)
  const mobileDockOccludedHeight = ref(0)
  const snapToGridEnabled = ref(true)
  const snapGridSize = ref(DEFAULT_SNAP_GRID_SIZE)
  const smartGuidesEnabled = ref(true)
  const smartGuideLines = ref<SmartGuideLines>({ vertical: [], horizontal: [], spreadSide: null })
  const printSafeZoneEnabled = ref(false)
  const textEditingElementId = ref<string | null>(null)
  const photoCropEditingElementId = ref<string | null>(null)
  const pageBackgroundCropEditing = ref(false)
  const pageBackgroundCropTarget = ref<PageBackgroundEditTarget>('spread')
  const activeSpreadBackgroundSide = ref<SpreadBackgroundSide>('left')
  const photoDimElementId = ref<string | null>(null)
  const photoDropTargetId = ref<string | null>(null)
  const liveDragPositions = ref<Record<string, Position>>({})
  /** Outermost → innermost currently-entered container ids; [] = at page/root level. */
  const groupEditingPath = ref<string[]>([])
  /** In-app copy/paste clipboard — deep-cloned snapshots, independent of the live document so
   * later edits to the originals (or undo/redo) can't leak into what gets pasted. */
  const clipboard = ref<PageElement[]>([])
  /** Set when the canvas background is clicked (deselecting) — the properties column should show
   * page settings then, not just disappear. Distinct from selection so that manually collapsing
   * the left panel (with nothing selected) does NOT also spring the properties column open —
   * only an explicit background click, or an actual selection, should. Cleared once the user
   * deliberately navigates to a left-panel rail category. */
  const pagePropertiesRequested = ref(false)

  /** Mobile-only: while true, tapping any element toggles it into/out of the selection instead
   * of replacing it (there's no shift key on touch to hold for the equivalent desktop gesture). */
  const multiSelectMode = ref(false)

  function enterMultiSelectMode(): void {
    multiSelectMode.value = true
  }

  function exitMultiSelectMode(): void {
    multiSelectMode.value = false
  }

  const historyPast = ref<CanvasSnapshot[]>([])
  const historyFuture = ref<CanvasSnapshot[]>([])

  let isApplyingHistory = false
  let debouncedHistorySnapshot: CanvasSnapshot | null = null
  let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let liveTransformActive = ref(false)
  /** Cascades successive pastes of the same copy diagonally instead of stacking them exactly on
   * top of each other — reset whenever a fresh copy is made. */
  let pasteCount = 0

  /** Root-level nodes, in paint order (array order = bottom → top). */
  const elements = computed(() => document.value?.canvasData.elements ?? [])

  /** Leaves only, at any depth, with ABSOLUTE page coordinates already composed. */
  const flatElements = computed(() => flattenTree(elements.value))

  const selectedElementId = computed(() => selectedElementIds.value[0] ?? null)

  const selectedElement = computed(() => {
    if (selectedElementIds.value.length !== 1) {
      return null
    }

    return findNodeById(elements.value, selectedElementIds.value[0])
  })

  const selectedElements = computed(() =>
    selectedElementIds.value
      .map((id) => findNodeById(elements.value, id))
      .filter((element): element is PageElement => element != null),
  )

  const alignableSelectedElements = computed(() =>
    selectedElements.value.filter((element) => !element.locked && element.visible),
  )

  const isMultiSelection = computed(() => selectedElementIds.value.length >= 2)
  const hasSelection = computed(() => selectedElementIds.value.length > 0)
  const selectionCount = computed(() => selectedElementIds.value.length)

  /** Whether the properties column (element or page settings) should be visible — an element
   * selection always shows it; an explicit page-properties request (background click) does too,
   * until the user navigates to a left-panel rail category. */
  const showPropertiesPanel = computed(() => hasSelection.value || pagePropertiesRequested.value)

  function requestPageProperties(): void {
    pagePropertiesRequested.value = true
  }

  function dismissPageProperties(): void {
    pagePropertiesRequested.value = false
  }

  /** Closes the properties column outright — clears whatever is currently making it show
   * (selection and/or a pending page-properties request). */
  function closePropertiesPanel(): void {
    if (hasSelection.value) {
      clearSelection()
    }
    dismissPageProperties()
  }

  function isElementSelected(id: string): boolean {
    return selectedElementIds.value.includes(id)
  }

  /** Innermost container currently being edited in isolation (double-click), or null at root. */
  const groupEditingId = computed(() => groupEditingPath.value.at(-1) ?? null)

  /** Root-first breadcrumb of the group nodes currently being navigated. */
  const groupEditingBreadcrumb = computed(() =>
    groupEditingPath.value
      .map((id) => findNodeById(elements.value, id))
      .filter((node): node is GroupElement => node != null && isGroupElement(node)),
  )

  /** Direct children of the level currently being edited (root elements when not isolated). */
  const currentScopeChildren = computed(() => {
    if (groupEditingId.value == null) {
      return elements.value
    }

    const scopeNode = findNodeById(elements.value, groupEditingId.value)
    return scopeNode && isGroupElement(scopeNode) ? scopeNode.children : []
  })

  const pageWidth = computed(() => document.value?.width ?? A4_PAGE_WIDTH)
  const pageHeight = computed(() => document.value?.height ?? A4_PAGE_HEIGHT)
  const backgroundColor = computed(
    () => document.value?.backgroundColor ?? DEFAULT_PAGE_BACKGROUND,
  )
  const backgroundImageUrl = computed(() => document.value?.backgroundImageUrl ?? null)
  const backgroundImageFit = computed(
    () => document.value?.backgroundImageFit ?? DEFAULT_PAGE_BACKGROUND_IMAGE_FIT,
  )
  const backgroundImageCropX = computed(() => document.value?.backgroundImageCropX ?? 0)
  const backgroundImageCropY = computed(() => document.value?.backgroundImageCropY ?? 0)
  const backgroundImageScale = computed(() => document.value?.backgroundImageScale ?? 1)
  const spreadBackgroundMode = computed(
    () => document.value?.spreadBackgroundMode ?? DEFAULT_SPREAD_BACKGROUND_MODE,
  )
  const leftPageBackground = computed(
    () =>
      document.value?.leftPageBackground ??
      createDefaultPageBackgroundSettings(document.value?.backgroundColor),
  )
  const rightPageBackground = computed(
    () =>
      document.value?.rightPageBackground ??
      createDefaultPageBackgroundSettings(document.value?.backgroundColor),
  )

  const editablePageBackgroundTarget = computed((): PageBackgroundEditTarget => {
    if (!isSpreadPage.value || spreadBackgroundMode.value === 'spread') {
      return 'spread'
    }

    return activeSpreadBackgroundSide.value
  })

  const editablePageBackground = computed((): PageBackgroundSettings => {
    if (!document.value) {
      return createDefaultPageBackgroundSettings()
    }

    return readPageBackgroundSettings(editablePageBackgroundTarget.value)
  })

  const pageBackgroundCropEditingKey = computed((): PageBackgroundEditTarget | null =>
    pageBackgroundCropEditing.value ? pageBackgroundCropTarget.value : null,
  )

  const pageBackgroundCropSettings = computed((): PageBackgroundSettings => {
    if (!document.value) {
      return createDefaultPageBackgroundSettings()
    }

    return readPageBackgroundSettings(pageBackgroundCropTarget.value)
  })

  const templateName = computed(() => document.value?.name ?? 'Страница')

  const isSpreadPage = computed(() => isSpreadPageType(document.value?.pageType))

  const printCropZoneViolation = computed(() => {
    if (previewMode.value) {
      return false
    }

    const elementsForCheck = flattenTree(elements.value, liveDragPositions.value)

    return hasElementsInPrintCropZone(
      elementsForCheck,
      pageWidth.value,
      pageHeight.value,
    )
  })

  const canUndo = computed(() => historyPast.value.length > 0 || debouncedHistorySnapshot !== null)
  const canRedo = computed(() => historyFuture.value.length > 0)

  function getPageBackgroundEditTarget(): PageBackgroundEditTarget {
    return editablePageBackgroundTarget.value
  }

  function readPageBackgroundSettings(target: PageBackgroundEditTarget): PageBackgroundSettings {
    if (!document.value) {
      return createDefaultPageBackgroundSettings()
    }

    if (target === 'spread') {
      return normalizePageBackgroundSettings({
        backgroundColor: document.value.backgroundColor,
        backgroundImageUrl: document.value.backgroundImageUrl,
        backgroundImageFit: document.value.backgroundImageFit,
        backgroundImageCropX: document.value.backgroundImageCropX,
        backgroundImageCropY: document.value.backgroundImageCropY,
        backgroundImageScale: document.value.backgroundImageScale,
      })
    }

    return normalizePageBackgroundSettings(
      target === 'left'
        ? document.value.leftPageBackground
        : document.value.rightPageBackground,
    )
  }

  function writePageBackgroundSettings(
    target: PageBackgroundEditTarget,
    settings: PageBackgroundSettings,
  ): void {
    if (!document.value) {
      return
    }

    if (target === 'spread') {
      document.value.backgroundColor = settings.backgroundColor
      document.value.backgroundImageUrl = settings.backgroundImageUrl
      document.value.backgroundImageFit = settings.backgroundImageFit
      document.value.backgroundImageCropX = settings.backgroundImageCropX
      document.value.backgroundImageCropY = settings.backgroundImageCropY
      document.value.backgroundImageScale = settings.backgroundImageScale
      return
    }

    if (target === 'left') {
      document.value.leftPageBackground = settings
      return
    }

    document.value.rightPageBackground = settings
  }

  function applyPageBackgroundPatch(
    target: PageBackgroundEditTarget,
    patch: PageSettingsPatch,
  ): void {
    if (!document.value) {
      return
    }

    const current = readPageBackgroundSettings(target)
    const next = normalizePageBackgroundSettings(
      {
        backgroundColor: patch.backgroundColor ?? current.backgroundColor,
        backgroundImageUrl:
          patch.backgroundImageUrl !== undefined
            ? patch.backgroundImageUrl
            : current.backgroundImageUrl,
        backgroundImageFit: patch.backgroundImageFit ?? current.backgroundImageFit,
        backgroundImageCropX:
          patch.backgroundImageCropX !== undefined
            ? patch.backgroundImageCropX
            : current.backgroundImageCropX,
        backgroundImageCropY:
          patch.backgroundImageCropY !== undefined
            ? patch.backgroundImageCropY
            : current.backgroundImageCropY,
        backgroundImageScale:
          patch.backgroundImageScale !== undefined
            ? patch.backgroundImageScale
            : current.backgroundImageScale,
      },
      current,
    )

    if (patch.backgroundImageUrl !== undefined && patch.backgroundImageUrl) {
      next.backgroundImageCropX = 0
      next.backgroundImageCropY = 0
      next.backgroundImageScale = 1
    }

    writePageBackgroundSettings(target, next)
    syncCanvasMeta()
  }

  function createSnapshot(): CanvasSnapshot {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    return JSON.parse(
      JSON.stringify({
        width: document.value.width,
        height: document.value.height,
        backgroundColor: document.value.backgroundColor,
        backgroundImageUrl: document.value.backgroundImageUrl,
        backgroundImageFit: document.value.backgroundImageFit,
        backgroundImageCropX: document.value.backgroundImageCropX,
        backgroundImageCropY: document.value.backgroundImageCropY,
        backgroundImageScale: document.value.backgroundImageScale,
        spreadBackgroundMode: document.value.spreadBackgroundMode,
        leftPageBackground: document.value.leftPageBackground,
        rightPageBackground: document.value.rightPageBackground,
        elements: document.value.canvasData.elements,
      }),
    ) as CanvasSnapshot
  }

  function clearHistory(): void {
    historyPast.value = []
    historyFuture.value = []
    debouncedHistorySnapshot = null
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer)
      historyDebounceTimer = null
    }
  }

  function flushDebouncedHistory(): void {
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer)
      historyDebounceTimer = null
    }

    if (debouncedHistorySnapshot) {
      historyPast.value.push(debouncedHistorySnapshot)
      if (historyPast.value.length > MAX_HISTORY) {
        historyPast.value.shift()
      }
      historyFuture.value = []
      debouncedHistorySnapshot = null
    }
  }

  function pushHistoryImmediate(): void {
    if (isApplyingHistory || !document.value) {
      return
    }

    flushDebouncedHistory()
    historyPast.value.push(createSnapshot())
    if (historyPast.value.length > MAX_HISTORY) {
      historyPast.value.shift()
    }
    historyFuture.value = []
  }

  function scheduleDebouncedHistory(): void {
    if (isApplyingHistory || !document.value) {
      return
    }

    if (!debouncedHistorySnapshot) {
      debouncedHistorySnapshot = createSnapshot()
    }

    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer)
    }

    historyDebounceTimer = setTimeout(() => {
      flushDebouncedHistory()
    }, HISTORY_DEBOUNCE_MS)
  }

  function applySnapshot(snapshot: CanvasSnapshot): void {
    if (!document.value) {
      return
    }

    isApplyingHistory = true
    document.value.width = snapshot.width
    document.value.height = snapshot.height
    document.value.backgroundColor = snapshot.backgroundColor
    document.value.backgroundImageUrl = snapshot.backgroundImageUrl
    document.value.backgroundImageFit = snapshot.backgroundImageFit
    document.value.backgroundImageCropX = snapshot.backgroundImageCropX
    document.value.backgroundImageCropY = snapshot.backgroundImageCropY
    document.value.backgroundImageScale = snapshot.backgroundImageScale
    document.value.spreadBackgroundMode =
      snapshot.spreadBackgroundMode ?? DEFAULT_SPREAD_BACKGROUND_MODE
    document.value.leftPageBackground =
      snapshot.leftPageBackground ??
      createPerPageBackgroundsFromRoot(document.value.canvasData).leftPageBackground
    document.value.rightPageBackground =
      snapshot.rightPageBackground ??
      createPerPageBackgroundsFromRoot(document.value.canvasData).rightPageBackground
    document.value.canvasData.elements = snapshot.elements
    syncCanvasMeta()

    if (selectedElementIds.value.length > 0 || groupEditingPath.value.length > 0) {
      const validIds = new Set<string>()
      walkTree(snapshot.elements, (node) => validIds.add(node.id))
      selectedElementIds.value = selectedElementIds.value.filter((id) => validIds.has(id))
      purgeGroupEditingPath(new Set([...groupEditingPath.value].filter((id) => !validIds.has(id))))
    }

    isApplyingHistory = false
    isDirty.value = true
  }

  function syncCanvasMeta(): void {
    if (!document.value) {
      return
    }

    document.value.canvasData.pageWidth = document.value.width
    document.value.canvasData.pageHeight = document.value.height
    document.value.canvasData.backgroundColor = document.value.backgroundColor
    document.value.canvasData.backgroundImageUrl = document.value.backgroundImageUrl
    document.value.canvasData.backgroundImageFit = document.value.backgroundImageFit
    document.value.canvasData.backgroundImageCropX = document.value.backgroundImageCropX
    document.value.canvasData.backgroundImageCropY = document.value.backgroundImageCropY
    document.value.canvasData.backgroundImageScale = document.value.backgroundImageScale
    document.value.canvasData.spreadBackgroundMode = document.value.spreadBackgroundMode

    if (document.value.spreadBackgroundMode === 'per-page') {
      document.value.canvasData.leftPageBackground = document.value.leftPageBackground
      document.value.canvasData.rightPageBackground = document.value.rightPageBackground
    } else {
      delete document.value.canvasData.leftPageBackground
      delete document.value.canvasData.rightPageBackground
    }
  }

  function loadDocument(source: EditorSourceDocument): void {
    const canvasData = normalizeCanvasData(source.canvasData)

    if (isSpreadPageType(source.pageType)) {
      canvasData.pageWidth = A4_SPREAD_PAGE_WIDTH
      canvasData.pageHeight = A4_SPREAD_PAGE_HEIGHT
    }

    const rootBackground = getRootPageBackgroundSettings(canvasData)
    const spreadMode = normalizeSpreadBackgroundMode(canvasData.spreadBackgroundMode)
    const perPageBackgrounds =
      spreadMode === 'per-page'
        ? {
            leftPageBackground: normalizePageBackgroundSettings(
              canvasData.leftPageBackground,
              rootBackground,
            ),
            rightPageBackground: normalizePageBackgroundSettings(
              canvasData.rightPageBackground,
              rootBackground,
            ),
          }
        : createPerPageBackgroundsFromRoot(canvasData)

    document.value = {
      id: source.id,
      name: source.name,
      pageType: source.pageType,
      width: canvasData.pageWidth ?? A4_PAGE_WIDTH,
      height: canvasData.pageHeight ?? A4_PAGE_HEIGHT,
      backgroundColor: rootBackground.backgroundColor,
      backgroundImageUrl: rootBackground.backgroundImageUrl,
      backgroundImageFit: rootBackground.backgroundImageFit,
      backgroundImageCropX: rootBackground.backgroundImageCropX,
      backgroundImageCropY: rootBackground.backgroundImageCropY,
      backgroundImageScale: rootBackground.backgroundImageScale,
      spreadBackgroundMode: isSpreadPageType(source.pageType) ? spreadMode : DEFAULT_SPREAD_BACKGROUND_MODE,
      leftPageBackground: perPageBackgrounds.leftPageBackground,
      rightPageBackground: perPageBackgrounds.rightPageBackground,
      canvasData,
    }
    activeSpreadBackgroundSide.value = 'left'
    pageBackgroundCropTarget.value = 'spread'
    selectedElementIds.value = []
    groupEditingPath.value = []
    liveDragPositions.value = {}
    previewMode.value = false
    canvasZoom.value = 1
    isDirty.value = false
    clearHistory()
    // Saved boxes stay as they were drawn. Re-measuring here (and again after fonts load) used
    // to move every text on open, before the user had edited anything.
    syncCanvasMeta()
  }

  function updatePageSettings(patch: PageSettingsPatch): void {
    if (!document.value) {
      return
    }

    const isSpread = isSpreadPageType(document.value.pageType)

    if (isSpread && (patch.width !== undefined || patch.height !== undefined)) {
      return
    }

    pushHistoryImmediate()

    if (patch.width !== undefined) {
      document.value.width = Math.max(100, patch.width)
    }
    if (patch.height !== undefined) {
      document.value.height = Math.max(100, patch.height)
    }

    if (patch.spreadBackgroundMode !== undefined && isSpread) {
      setSpreadBackgroundMode(patch.spreadBackgroundMode, { recordHistory: false })
      return
    }

    const backgroundPatch: PageSettingsPatch = {}
    if (patch.backgroundColor !== undefined) {
      backgroundPatch.backgroundColor = patch.backgroundColor
    }
    if (patch.backgroundImageUrl !== undefined) {
      backgroundPatch.backgroundImageUrl = patch.backgroundImageUrl
    }
    if (patch.backgroundImageFit !== undefined) {
      backgroundPatch.backgroundImageFit = patch.backgroundImageFit
    }
    if (patch.backgroundImageCropX !== undefined) {
      backgroundPatch.backgroundImageCropX = patch.backgroundImageCropX
    }
    if (patch.backgroundImageCropY !== undefined) {
      backgroundPatch.backgroundImageCropY = patch.backgroundImageCropY
    }
    if (patch.backgroundImageScale !== undefined) {
      backgroundPatch.backgroundImageScale = patch.backgroundImageScale
    }

    if (Object.keys(backgroundPatch).length > 0) {
      applyPageBackgroundPatch(getPageBackgroundEditTarget(), backgroundPatch)
    }

    syncCanvasMeta()
    isDirty.value = true
  }

  function setSpreadBackgroundMode(
    mode: SpreadBackgroundMode,
    options?: { recordHistory?: boolean },
  ): void {
    if (!document.value || !isSpreadPageType(document.value.pageType)) {
      return
    }

    const currentMode = document.value.spreadBackgroundMode
    if (currentMode === mode) {
      return
    }

    if (options?.recordHistory !== false) {
      pushHistoryImmediate()
    }

    if (mode === 'per-page') {
      const perPage = createPerPageBackgroundsFromRoot(document.value.canvasData)
      document.value.leftPageBackground = perPage.leftPageBackground
      document.value.rightPageBackground = perPage.rightPageBackground
    } else {
      const leftBackground = document.value.leftPageBackground
      document.value.backgroundColor = leftBackground.backgroundColor
      document.value.backgroundImageUrl = leftBackground.backgroundImageUrl
      document.value.backgroundImageFit = leftBackground.backgroundImageFit
      document.value.backgroundImageCropX = leftBackground.backgroundImageCropX
      document.value.backgroundImageCropY = leftBackground.backgroundImageCropY
      document.value.backgroundImageScale = leftBackground.backgroundImageScale
    }

    document.value.spreadBackgroundMode = mode
    stopPageBackgroundCropEditing()
    syncCanvasMeta()
    isDirty.value = true
  }

  function setActiveSpreadBackgroundSide(side: SpreadBackgroundSide): void {
    if (activeSpreadBackgroundSide.value === side) {
      return
    }

    stopPageBackgroundCropEditing()
    activeSpreadBackgroundSide.value = side
  }

  function setTextFitMode(mode: 'grow' | 'shrink'): void {
    textFitMode.value = mode
  }

  function recalculateTextElementSize(
    id: string,
    displayText?: string | null,
    options?: { fit?: 'hug' | 'grow' },
  ): void {
    if (!document.value) {
      return
    }

    const location = locateNode(document.value.canvasData.elements, id)
    if (!location || !isTextPlaceholderType(location.node.type)) {
      return
    }

    const element = location.node as TextPlaceholder
    // List rows own their own box and font (list-distribution). Reflowing them here fights that.
    if (element.listRole) {
      return
    }

    const layout = recalculateTextLayout({
      element,
      displayText,
      pageWidth: document.value.width,
      fit: options?.fit ?? 'grow',
    })
    const position = positionForTopLeftAnchor(
      element.position,
      element.size,
      layout.size,
      element.rotation,
    )

    if (
      layout.size.width === element.size.width &&
      layout.size.height === element.size.height &&
      position.x === element.position.x &&
      position.y === element.position.y
    ) {
      return
    }

    location.siblings[location.index] = {
      ...element,
      size: layout.size,
      position,
    } as PageElement
  }

  /** Journal editor: keep the template frame, change only the font so the answer fits inside it.
   * Grows back up to `designFontSize` when the customer deletes text. Never moves x/y or the box. */
  function refitTextFontToFrame(id: string, options?: { adoptFontSize?: boolean }): void {
    if (!document.value || textFitMode.value !== 'shrink') {
      return
    }

    const location = locateNode(document.value.canvasData.elements, id)
    if (!location || !isTextPlaceholderType(location.node.type)) {
      return
    }

    const element = location.node as TextPlaceholder
    if (element.listRole) {
      return
    }

    const design = options?.adoptFontSize
      ? element.fontSize
      : (element.designFontSize ?? element.fontSize)
    const text = resolveTextContent(element)
    const boxWidth = Math.max(1, element.size.width)
    const boxHeight = element.size.height
    const fitted = fitFontSizeToBox({
      designFontSize: design,
      fits: (fontSize) =>
        measureKonvaText({
          text,
          element: { ...element, fontSize },
          maxWidth: boxWidth,
        }).textHeight <= boxHeight + 1,
    })

    if (fitted === element.fontSize && design === element.designFontSize) {
      return
    }

    location.siblings[location.index] = {
      ...element,
      fontSize: fitted,
      designFontSize: design,
    } as PageElement
  }

  function setLiveDragPosition(id: string, position: Position): void {
    liveDragPositions.value = {
      ...liveDragPositions.value,
      [id]: position,
    }
  }

  function setLiveDragPositions(positions: Record<string, Position>): void {
    liveDragPositions.value = {
      ...liveDragPositions.value,
      ...positions,
    }
  }

  function clearLiveDragPosition(id: string): void {
    if (!(id in liveDragPositions.value)) {
      return
    }

    const next = { ...liveDragPositions.value }
    delete next[id]
    liveDragPositions.value = next
  }

  function clearLiveDragPositions(ids?: string[]): void {
    if (!ids || ids.length === 0) {
      liveDragPositions.value = {}
      return
    }

    const next = { ...liveDragPositions.value }
    for (const id of ids) {
      delete next[id]
    }
    liveDragPositions.value = next
  }

  function moveElementsPositions(
    patches: Array<{ id: string; position: Position }>,
  ): void {
    if (!document.value || previewMode.value || patches.length === 0) {
      return
    }

    scheduleDebouncedHistory()

    const root = document.value.canvasData.elements

    for (const patch of patches) {
      const location = locateNode(root, patch.id)
      if (!location) {
        continue
      }

      location.siblings[location.index] = {
        ...location.node,
        // Rounded for the same reason as in updateElement — this is the multi-element drag/
        // transform commit path, and Konva's pointer coordinates are fractional.
        position: { x: Math.round(patch.position.x), y: Math.round(patch.position.y) },
      } as PageElement
    }

    isDirty.value = true
  }

  /** New elements land inside the container currently being edited in isolation, if any. */
  function insertNewElement(element: PageElement, parentId: string | null = groupEditingId.value): void {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    pushHistoryImmediate()

    const root = document.value.canvasData.elements
    const parent = parentId != null ? findNodeById(root, parentId) : null
    const siblings = parent && isGroupElement(parent) ? parent.children : root

    siblings.push(element)
    if (isTextPlaceholderType(element.type)) {
      // The factory box is a placeholder. Hug it to the words once, then never shrink it.
      recalculateTextElementSize(element.id, undefined, { fit: 'hug' })

      if (typeof globalThis.document !== 'undefined') {
        void globalThis.document.fonts.ready.then(() => {
          // Real font metrics can only make the new box larger. Saved elements are not touched.
          recalculateTextElementSize(element.id, undefined, { fit: 'grow' })
        })
      }
    }
    selectedElementIds.value = [element.id]
    isDirty.value = true
  }

  function addElement(type: LibraryElementType): PageElement {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    const element = createElementFromLibrary(type, document.value.width, document.value.height)
    insertNewElement(element)
    return element
  }

  function addFramedPhoto(frame: PhotoFrameRef): PageElement {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    const element = createElementFromLibrary(
      'photo-placeholder',
      document.value.width,
      document.value.height,
    ) as PhotoPlaceholder

    element.frame = frame
    insertNewElement(element)
    return element
  }

  function duplicateElement(id?: string): PageElement | null {
    if (!document.value) {
      return null
    }

    const sourceIds = id
      ? [id]
      : selectedElementIds.value.length > 0
        ? [...selectedElementIds.value]
        : []

    if (sourceIds.length === 0) {
      return null
    }

    pushHistoryImmediate()

    const root = document.value.canvasData.elements
    const clones: PageElement[] = []

    for (const sourceId of sourceIds) {
      const location = locateNode(root, sourceId)
      if (!location) {
        continue
      }

      const clone = cloneSubtree(location.node)
      clone.name = `${location.node.name} (копия)`
      clone.position = {
        x: location.node.position.x + 20,
        y: location.node.position.y + 20,
      }
      clone.locked = false

      location.siblings.splice(location.index + 1, 0, clone)
      walkTree([clone], (node) => {
        if (isTextPlaceholderType(node.type)) {
          recalculateTextElementSize(node.id, undefined, { fit: 'grow' })
        }
      })
      clones.push(clone)
    }

    if (clones.length === 0) {
      return null
    }

    relinkClonedAiTextChains(clones)
    relinkClonedListRows(clones)

    selectedElementIds.value = clones.map((clone) => clone.id)
    isDirty.value = true
    return clones[clones.length - 1]
  }

  const hasClipboardContent = computed(() => clipboard.value.length > 0)

  function copySelection(): void {
    if (!document.value || selectedElementIds.value.length === 0) {
      return
    }

    const root = document.value.canvasData.elements
    const copied: PageElement[] = []

    for (const id of selectedElementIds.value) {
      const node = findNodeById(root, id)
      if (node) {
        copied.push(cloneSubtree(node))
      }
    }

    if (copied.length === 0) {
      return
    }

    clipboard.value = copied
    pasteCount = 0
  }

  /** Pastes into whatever container is currently isolated (groupEditingId), same anchor
   * insertNewElement uses — root when nothing is isolated. */
  function pasteClipboard(): PageElement[] {
    if (!document.value || clipboard.value.length === 0) {
      return []
    }

    pushHistoryImmediate()

    const root = document.value.canvasData.elements
    const parentId = groupEditingId.value
    const parent = parentId != null ? findNodeById(root, parentId) : null
    const siblings = parent && isGroupElement(parent) ? parent.children : root

    pasteCount += 1
    const offset = 20 * pasteCount
    const pasted: PageElement[] = []

    for (const item of clipboard.value) {
      const clone = cloneSubtree(item)
      clone.position = {
        x: clone.position.x + offset,
        y: clone.position.y + offset,
      }
      siblings.push(clone)
      pasted.push(clone)
    }

    relinkClonedAiTextChains(pasted)
    relinkClonedListRows(pasted)

    walkTree(pasted, (node) => {
      if (isTextPlaceholderType(node.type)) {
        recalculateTextElementSize(node.id, undefined, { fit: 'grow' })
      }
    })

    selectedElementIds.value = pasted.map((clone) => clone.id)
    isDirty.value = true
    return pasted
  }

  /**
   * Chain links on freshly cloned (duplicated/pasted, already inserted) subtrees: a lone cloned
   * part joins its original chain as the new LAST part — so "duplicate" on a part doubles as "add
   * a part" — while 2+ parts of one chain cloned together (e.g. a whole group duplicated) become
   * an independent chain of their own, instead of interleaving with the originals.
   */
  function relinkClonedAiTextChains(clones: PageElement[]): void {
    if (!document.value) {
      return
    }

    const clonedPartsByChain = new Map<string, AiTextPlaceholder[]>()
    walkTree(clones, (node) => {
      if (isAiTextElement(node) && node.chainId) {
        const parts = clonedPartsByChain.get(node.chainId) ?? []
        parts.push(node)
        clonedPartsByChain.set(node.chainId, parts)
      }
    })

    const root = document.value.canvasData.elements
    for (const [chainId, clonedParts] of clonedPartsByChain) {
      if (clonedParts.length > 1) {
        const freshChainId = generateAiTextChainId()
        for (const part of clonedParts) {
          part.chainId = freshChainId
        }
        continue
      }

      const allParts = getAiTextChainParts(root, chainId)
      const maxOrder = Math.max(...allParts.filter((part) => part !== clonedParts[0]).map((part) => part.chainOrder), 0)
      clonedParts[0].chainOrder = maxOrder + 1
    }
  }

  /** Mirrors the chain-wide fields (prompt, questionKeys) onto every part of `id`'s chain — or
   * just `id` itself when it's standalone. */
  function updateAiTextShared(id: string, patch: AiTextSharedPatch): void {
    if (!document.value) {
      return
    }

    const element = findNodeById(document.value.canvasData.elements, id)
    if (!element || !isAiTextElement(element)) {
      return
    }

    for (const part of getAiTextSiblingParts(document.value.canvasData.elements, element)) {
      updateElement(part.id, patch)
    }
  }

  // ---------------------------------------------------------------------------
  // Lists — rows are ordinary elements sharing a `listId`, read in `listOrder`, laid out for the
  // customer's filled items at render time (see list.model.ts / list-distribution.util.ts). No
  // container: each row stays selectable on its own. List-wide settings are mirrored onto every
  // row; roles and the question live on the rows' texts, so the backend's answer sync and every
  // renderer read them like any other bound text.
  // ---------------------------------------------------------------------------

  /** The list `id` is a row of, or sits inside a row of, if any. */
  function findListOf(id: string): ListInfo | null {
    if (!document.value) {
      return null
    }
    return (
      collectLists(document.value.canvasData.elements).find((list) =>
        list.rows.some((row) => row.node.id === id || getDescendants(row.node).some((node) => node.id === id)),
      ) ?? null
    )
  }

  function findListById(listId: string): ListInfo | null {
    return document.value
      ? (collectLists(document.value.canvasData.elements).find((list) => list.listId === listId) ?? null)
      : null
  }

  function textsOfRow(row: PageElement): TextPlaceholder[] {
    return (isGroupElement(row) ? getDescendants(row) : [row]).filter(isTextElement)
  }

  /** The given elements (those that exist), top to bottom then left to right — the reading order
   * new rows start with. */
  function nodesInReadingOrder(ids: string[]): PageElement[] {
    if (!document.value) {
      return []
    }
    const root = document.value.canvasData.elements
    return ids
      .map((id) => findNodeById(root, id))
      .filter((node): node is PageElement => node !== null)
      .map((node) => {
        const box = getAbsoluteTransform(root, node.id)
        return { node, x: box.x + node.size.width / 2, y: box.y + node.size.height / 2 }
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map(({ node }) => node)
  }

  /** Makes `node` a row of `listId` at `order`. Texts without a role get a guess — a text that's
   * just a number is the row number; of the others, the topmost is the item's title and the next
   * one down its description — and the title/description take the list's question. */
  function attachListRow(node: PageElement, listId: string, order: number, settings: ListSettings): void {
    updateElement(
      node.id,
      { listId, listOrder: order, list: settings, listColumnBreak: false },
      { skipTextLayoutRecalc: true },
    )
    const texts = textsOfRow(node)
    if (!texts.some((text) => text.listRole)) {
      const number = texts.find((text) => /^\s*\d+[.)]?\s*$/.test(text.defaultText ?? ''))
      const [item, detail] = texts
        .filter((text) => text !== number)
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      if (number) {
        updateElement(number.id, { listRole: 'number' }, { skipTextLayoutRecalc: true })
      }
      if (item) {
        updateElement(item.id, { listRole: 'item' }, { skipTextLayoutRecalc: true })
      }
      if (detail) {
        updateElement(detail.id, { listRole: 'detail' }, { skipTextLayoutRecalc: true })
      }
    }
    // Re-read: the role updates above replaced the texts in the tree.
    const current = document.value ? findNodeById(document.value.canvasData.elements, node.id) : null
    for (const text of current && settings.questionKey ? textsOfRow(current) : []) {
      if (text.listRole === 'item' || text.listRole === 'detail') {
        updateElement(text.id, { questionKey: settings.questionKey }, { skipTextLayoutRecalc: true })
      }
    }
  }

  /** Turns the given elements into the rows of a new list, read top to bottom (then left to right)
   * to start with. */
  function makeList(ids: string[]): string | null {
    if (!document.value || previewMode.value) {
      return null
    }
    const nodes = nodesInReadingOrder(ids)
    if (nodes.length === 0) {
      return null
    }
    const listId = `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    nodes.forEach((node, index) => attachListRow(node, listId, index, { questionKey: null }))
    return listId
  }

  /** Appends the given elements to an existing list as its last rows (top to bottom among
   * themselves); one that already is a row of another list moves over. */
  function addToList(listId: string, ids: string[]): void {
    const list = findListById(listId)
    if (!list || previewMode.value) {
      return
    }
    const nodes = nodesInReadingOrder(ids).filter((node) => node.listId !== listId)
    let order = Math.max(-1, ...list.rows.map((row) => row.node.listOrder)) + 1
    for (const node of nodes) {
      if (node.listId) {
        removeListRow(node.id)
      }
      // Re-read: detaching replaced the node (and its texts) in the tree.
      const current = document.value ? findNodeById(document.value.canvasData.elements, node.id) : null
      if (current) {
        attachListRow(current, listId, order, list.settings)
        order += 1
      }
    }
  }

  /** Takes `row` out of its list: its list fields, its texts' roles and the list's question
   * binding are dropped. */
  function detachListRow(row: PageElement, questionKey: string | null): void {
    for (const text of textsOfRow(row)) {
      if (text.listRole) {
        const unbind = (text.listRole === 'item' || text.listRole === 'detail') && text.questionKey === questionKey
        updateElement(text.id, { listRole: null, ...(unbind && { questionKey: null }) }, { skipTextLayoutRecalc: true })
      }
    }
    updateElement(
      row.id,
      { listId: null, listOrder: undefined, list: null, listColumnBreak: false },
      { skipTextLayoutRecalc: true },
    )
  }

  /** Dissolves the whole list — every row becomes an ordinary element again. */
  function removeList(listId: string): void {
    const list = findListById(listId)
    if (list) {
      list.rows.forEach((row) => detachListRow(row.node, list.settings.questionKey))
    }
  }

  /** Takes one row out of its list; the rest close up the reading order. */
  function removeListRow(rowId: string): void {
    const list = findListOf(rowId)
    const row = list?.rows.find((candidate) => candidate.node.id === rowId)
    if (!list || !row) {
      return
    }
    detachListRow(row.node, list.settings.questionKey)
    list.rows
      .filter((candidate) => candidate !== row)
      .forEach((candidate, index) => updateElement(candidate.node.id, { listOrder: index }, { skipTextLayoutRecalc: true }))
  }

  /** Writes list-wide settings onto every row (they're mirrored — see list.model.ts). */
  function patchListSettings(listId: string, patch: Partial<ListSettings>): void {
    const list = findListById(listId)
    if (!list) {
      return
    }
    const settings: ListSettings = { ...list.settings, ...patch }
    for (const row of list.rows) {
      updateElement(row.node.id, { list: settings }, { skipTextLayoutRecalc: true })
    }
  }

  /** Binds the list to a LIST question — mirrored onto every row's title ('item') and description
   * ('detail') texts. */
  function setListQuestion(listId: string, questionKey: string | null): void {
    const list = findListById(listId)
    if (!list) {
      return
    }
    patchListSettings(listId, { questionKey })
    for (const row of list.rows) {
      for (const text of textsOfRow(row.node)) {
        if (text.listRole === 'item' || text.listRole === 'detail') {
          updateElement(text.id, { questionKey }, { skipTextLayoutRecalc: true })
        }
      }
    }
  }

  function setListMinItems(listId: string, minItems: number): void {
    const list = findListById(listId)
    if (list) {
      patchListSettings(listId, { minItems: Math.max(0, Math.min(Math.round(minItems), list.rows.length)) })
    }
  }

  function setListMode(listId: string, mode: ListLayoutMode): void {
    patchListSettings(listId, { mode })
  }

  /** Rows laid out by real text height inside each column's fixed area — see list.model.ts. */
  function setListFlowSettings(
    listId: string,
    patch: Partial<Pick<ListSettings, 'heightMode' | 'flowAlign' | 'minGap' | 'minFontScale'>>,
  ): void {
    patchListSettings(listId, patch)
  }

  /** The length limit of the items' titles or descriptions; null — back to the texts' own maxLength. */
  function setListTextLimit(listId: string, field: 'title' | 'detail', limit: ListTextLimit | null): void {
    patchListSettings(listId, field === 'title' ? { titleLimit: limit } : { detailLimit: limit })
  }

  /** "Предложить пункты": shown or not, and the admin's prompt (undefined — back to the default). */
  function setListSuggestSettings(
    listId: string,
    patch: Partial<Pick<ListSettings, 'suggestEnabled' | 'suggestPrompt'>>,
  ): void {
    patchListSettings(listId, patch)
  }

  /** The admin's own places for `count` items (row indices in reading order — stored as the rows'
   * ids, so reordering keeps them), or null to go back to the mode's. */
  function setListSlots(listId: string, count: number, slots: number[] | null): void {
    const list = findListById(listId)
    if (!list) {
      return
    }
    const slotsByCount = { ...list.settings.slotsByCount }
    if (slots) {
      slotsByCount[String(count)] = slots
        .filter((index) => index >= 0 && index < list.rows.length)
        .map((index) => list.rows[index].node.id)
    } else {
      delete slotsByCount[String(count)]
    }
    patchListSettings(listId, { slotsByCount })
  }

  /** A text's role in its list row; a title/description takes the list's question, a text leaving
   * those roles drops it. */
  function setListRole(textId: string, role: ListRole | null): void {
    const list = findListOf(textId)
    const text = document.value ? findNodeById(document.value.canvasData.elements, textId) : null
    if (!list || !text || !isTextElement(text)) {
      return
    }
    const listKey = list.settings.questionKey
    const fromAnswer = (value: ListRole | null | undefined): boolean => value === 'item' || value === 'detail'
    const questionKey = fromAnswer(role)
      ? listKey
      : fromAnswer(text.listRole) && text.questionKey === listKey
        ? null
        : text.questionKey
    updateElement(textId, { listRole: role, questionKey }, { skipTextLayoutRecalc: true })
  }

  /** Copies the typography of `rowId`'s texts onto the same-role texts of every other row of its
   * list (number → numbers, title → titles, description → descriptions) — positions and sizes stay as each row has them. */
  function applyListRowStyle(rowId: string): void {
    const list = findListOf(rowId)
    const source = list?.rows.find((row) => row.node.id === rowId)
    if (!list || !source || previewMode.value) {
      return
    }
    for (const role of ['number', 'item', 'detail'] as const) {
      const model = textsOfRow(source.node).find((text) => text.listRole === role)
      if (!model) {
        continue
      }
      const style = {
        fontFamily: model.fontFamily,
        fontSize: model.fontSize,
        fontWeight: model.fontWeight,
        fontItalic: model.fontItalic,
        lineHeight: model.lineHeight,
        letterSpacing: model.letterSpacing,
        textAlign: model.textAlign,
        verticalAlign: model.verticalAlign,
        textTransform: model.textTransform,
        color: model.color,
        effect: model.effect ? structuredClone(toRaw(model.effect)) : null,
      }
      for (const row of list.rows) {
        if (row === source) {
          continue
        }
        for (const text of textsOfRow(row.node)) {
          if (text.listRole === role) {
            updateElement(text.id, style)
          }
        }
      }
    }
  }

  /** Moves row `rowId` one step earlier/later in the list's reading order. */
  function moveListRow(listId: string, rowId: string, direction: 'earlier' | 'later'): void {
    const list = findListById(listId)
    if (!list) {
      return
    }
    const index = list.rows.findIndex((row) => row.node.id === rowId)
    const target = direction === 'earlier' ? index - 1 : index + 1
    if (index === -1 || target < 0 || target >= list.rows.length) {
      return
    }
    updateElement(list.rows[index].node.id, { listOrder: target }, { skipTextLayoutRecalc: true })
    updateElement(list.rows[target].node.id, { listOrder: index }, { skipTextLayoutRecalc: true })
  }

  function reverseListRows(listId: string): void {
    const list = findListById(listId)
    const last = (list?.rows.length ?? 0) - 1
    list?.rows.forEach((row, index) =>
      updateElement(row.node.id, { listOrder: last - index }, { skipTextLayoutRecalc: true }),
    )
  }

  /** Same idea as relinkClonedAiTextChains: a lone cloned row joins its list as the new LAST row —
   * so "duplicate" on a row doubles as "add a row" — while 2+ rows of one list cloned together
   * become a list of their own. */
  function relinkClonedListRows(clones: PageElement[]): void {
    if (!document.value) {
      return
    }

    const clonedRowsByList = new Map<string, PageElement[]>()
    walkTree(clones, (node) => {
      if (node.listId) {
        const rows = clonedRowsByList.get(node.listId) ?? []
        rows.push(node)
        clonedRowsByList.set(node.listId, rows)
      }
    })

    for (const [listId, clonedRows] of clonedRowsByList) {
      if (clonedRows.length > 1) {
        const freshListId = `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        for (const row of clonedRows) {
          row.listId = freshListId
        }
        continue
      }
      const others = findListById(listId)?.rows.filter((row) => row.node !== clonedRows[0]) ?? []
      clonedRows[0].listOrder = Math.max(-1, ...others.map((row) => row.node.listOrder)) + 1
    }
  }

  /** Adds a new part right after the chain's current last part — a clone of `id` (same typography,
   * prompt and length), placed next to it: to the right when the page has room, otherwise below.
   * A standalone block becomes part 1 of a new chain. */
  function addAiTextChainPart(id: string): PageElement | null {
    if (!document.value || previewMode.value) {
      return null
    }

    const root = document.value.canvasData.elements
    const source = findNodeById(root, id)
    if (!source || !isAiTextElement(source)) {
      return null
    }

    pushHistoryImmediate()

    if (!source.chainId) {
      source.chainId = generateAiTextChainId()
      source.chainOrder = 1
    }

    const parts = getAiTextChainParts(root, source.chainId)
    const last = parts[parts.length - 1]
    const lastLocation = locateNode(root, last.id)
    if (!lastLocation) {
      return null
    }

    const clone = cloneSubtree(last) as AiTextPlaceholder
    clone.chainOrder = last.chainOrder + 1
    clone.partHint = ''
    clone.name = `${source.label} — часть ${parts.length + 1}`
    clone.locked = false

    const gap = 16
    const lastBounds = getElementAbsoluteBounds(root, last.id)
    const fitsRight = lastBounds.x + lastBounds.width * 2 + gap <= document.value.width
    clone.position = fitsRight
      ? { x: last.position.x + last.size.width + gap, y: last.position.y }
      : { x: last.position.x, y: last.position.y + last.size.height + gap }

    lastLocation.siblings.splice(lastLocation.index + 1, 0, clone)
    selectedElementIds.value = [clone.id]
    isDirty.value = true
    return clone
  }

  /**
   * The cover's "Фраза обложки" library item: the first click creates a ready-made cover line
   * (independent phrases, generated from the whole journal once the questionnaire is done, short
   * word limit, display-sized type); every later click adds one more phrase to that same set — a
   * clone of its last phrase, see addAiTextChainPart — so the admin only decides how many and
   * where they go.
   */
  function addCoverPhrase(): PageElement | null {
    if (!document.value || previewMode.value) {
      return null
    }

    let existing: AiTextPlaceholder | null = null
    walkTree(document.value.canvasData.elements, (node) => {
      if (!existing && isAiTextElement(node) && node.contentSource === 'journal' && node.chainMode === 'phrases') {
        existing = node
      }
    })
    if (existing) {
      return addAiTextChainPart((existing as AiTextPlaceholder).id)
    }

    const element = createElementFromLibrary(
      'ai-text-placeholder',
      document.value.width,
      document.value.height,
    ) as AiTextPlaceholder

    Object.assign(element, {
      name: 'Фраза обложки',
      label: 'Фраза обложки',
      prompt:
        'Короткие яркие фразы для обложки журнала — как анонсы на обложке настоящего журнала. ' +
        'Они описывают человека, которому посвящён журнал: его характер, увлечения, важные моменты.',
      lengthConstraint: { unit: 'words', min: 3, max: 8 },
      chainId: generateAiTextChainId(),
      chainOrder: 1,
      chainMode: 'phrases',
      contentSource: 'journal',
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 1.2,
      size: { width: 260, height: 64 },
    } satisfies Partial<AiTextPlaceholder>)

    insertNewElement(element)
    return element
  }

  /** Detaches `id` into a standalone block (keeps its current prompt). A chain left with a single
   * part is dissolved too, so that part goes back to being an ordinary standalone block. */
  function unlinkAiTextChainPart(id: string): void {
    if (!document.value || previewMode.value) {
      return
    }

    const root = document.value.canvasData.elements
    const element = findNodeById(root, id)
    if (!element || !isAiTextElement(element) || !element.chainId) {
      return
    }

    pushHistoryImmediate()

    const remaining = getAiTextChainParts(root, element.chainId).filter((part) => part.id !== id)
    element.chainId = null
    element.chainOrder = 0
    if (remaining.length === 1) {
      remaining[0].chainId = null
      remaining[0].chainOrder = 0
    }
    isDirty.value = true
  }

  /** Swaps `id` with its neighbour in the chain's reading order. Renumbers the whole chain to
   * 1..n first, so gaps/duplicate orders left by deletions or pastes can't make a swap a no-op. */
  function moveAiTextChainPart(id: string, direction: 'earlier' | 'later'): void {
    if (!document.value || previewMode.value) {
      return
    }

    const root = document.value.canvasData.elements
    const element = findNodeById(root, id)
    if (!element || !isAiTextElement(element) || !element.chainId) {
      return
    }

    const parts = getAiTextChainParts(root, element.chainId)
    const index = parts.findIndex((part) => part.id === id)
    const targetIndex = direction === 'earlier' ? index - 1 : index + 1
    if (index === -1 || targetIndex < 0 || targetIndex >= parts.length) {
      return
    }

    pushHistoryImmediate()

    ;[parts[index], parts[targetIndex]] = [parts[targetIndex], parts[index]]
    parts.forEach((part, order) => {
      part.chainOrder = order + 1
    })
    isDirty.value = true
  }

  /** Truncates the isolation breadcrumb at the first id no longer present after a removal/undo. */
  function purgeGroupEditingPath(removedIds: Set<string>): void {
    const validPath: string[] = []
    for (const pathId of groupEditingPath.value) {
      if (removedIds.has(pathId)) {
        break
      }
      validPath.push(pathId)
    }
    groupEditingPath.value = validPath
  }

  /** Total number of descendants across the given ids — for a delete confirmation message. */
  function getRemovalImpactCount(ids: string[]): number {
    if (!document.value) {
      return 0
    }

    const root = document.value.canvasData.elements
    return ids.reduce((total, id) => {
      const node = findNodeById(root, id)
      return node ? total + countDescendants(node) : total
    }, 0)
  }

  function removeElement(id: string): void {
    if (!document.value || previewMode.value) {
      return
    }

    pushHistoryImmediate()

    const root = document.value.canvasData.elements
    const location = locateNode(root, id)
    if (!location) {
      return
    }

    const removedIds = new Set([id, ...getDescendants(location.node).map((node) => node.id)])
    location.siblings.splice(location.index, 1)

    selectedElementIds.value = selectedElementIds.value.filter(
      (selectedId) => !removedIds.has(selectedId),
    )
    purgeGroupEditingPath(removedIds)
    isDirty.value = true
  }

  function removeSelectedElements(): void {
    if (!document.value || previewMode.value || selectedElementIds.value.length === 0) {
      return
    }

    pushHistoryImmediate()

    const root = document.value.canvasData.elements
    const idsToRemove = [...selectedElementIds.value]
    const removedIds = new Set<string>()

    for (const id of idsToRemove) {
      // Skip ids whose ancestor is also selected — already removed recursively as part of it.
      if (getAncestors(root, id).some((ancestor) => idsToRemove.includes(ancestor.id))) {
        continue
      }

      const location = locateNode(root, id)
      if (!location) {
        continue
      }

      removedIds.add(id)
      for (const descendant of getDescendants(location.node)) {
        removedIds.add(descendant.id)
      }
      location.siblings.splice(location.index, 1)
    }

    selectedElementIds.value = []
    purgeGroupEditingPath(removedIds)
    isDirty.value = true
  }

  function exitAllEditingModes(): void {
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    photoDimElementId.value = null
    pageBackgroundCropEditing.value = false
  }

  function clearSelection(): void {
    selectedElementIds.value = []
    exitAllEditingModes()
  }

  /** Resolves a click on any node up to the right selectable target: the outermost container at
   * root level, or the direct child of the container currently being edited in isolation. */
  function resolveSelectionTarget(id: string): string {
    if (!document.value) {
      return id
    }

    const root = document.value.canvasData.elements
    const path = getAncestors(root, id)
    const scopeId = groupEditingId.value

    if (scopeId == null) {
      return path.length > 0 ? path[0].id : id
    }

    const scopeIndex = path.findIndex((ancestor) => ancestor.id === scopeId)
    if (scopeIndex === -1) {
      return path.length > 0 ? path[0].id : id
    }

    if (scopeIndex === path.length - 1) {
      return id
    }

    return path[scopeIndex + 1].id
  }

  /** Selects a node exactly as clicked in the layers panel (unlike canvas clicks, this does not
   * resolve upward) — syncs the isolation scope to the node's own ancestor chain first. */
  function selectFromLayersPanel(id: string): void {
    if (previewMode.value || !document.value) {
      return
    }

    const ancestors = getAncestors(document.value.canvasData.elements, id)
    groupEditingPath.value = ancestors.map((ancestor) => ancestor.id)
    selectedElementIds.value = [id]
  }

  /** A click outside the currently isolated container's branch exits isolation entirely — the
   * outer container is otherwise locked/non-interactive, matching the "must be able to step out"
   * requirement without needing exact per-ancestor partial-exit bookkeeping. */
  function syncGroupEditingScopeForClick(id: string): void {
    if (!document.value || groupEditingPath.value.length === 0) {
      return
    }

    const ancestorIds = getAncestors(document.value.canvasData.elements, id).map(
      (ancestor) => ancestor.id,
    )
    const isWithinActiveScope = groupEditingPath.value.every(
      (scopeId, index) => ancestorIds[index] === scopeId,
    )

    if (!isWithinActiveScope) {
      groupEditingPath.value = []
    }
  }

  function setSelection(ids: string[]): void {
    if (previewMode.value) {
      return
    }

    selectedElementIds.value = [...new Set(ids)]
  }

  function selectElement(id: string | null): void {
    if (previewMode.value) {
      return
    }

    if (id) {
      syncGroupEditingScopeForClick(id)
    }

    selectedElementIds.value = id ? [resolveSelectionTarget(id)] : []
  }

  function toggleElementSelection(id: string): void {
    if (previewMode.value) {
      return
    }

    syncGroupEditingScopeForClick(id)
    const resolvedId = resolveSelectionTarget(id)

    if (selectedElementIds.value.includes(resolvedId)) {
      selectedElementIds.value = selectedElementIds.value.filter(
        (selectedId) => selectedId !== resolvedId,
      )
      return
    }

    selectedElementIds.value = [...selectedElementIds.value, resolvedId]
  }

  function selectElementsInRect(
    rect: { x: number; y: number; width: number; height: number },
    additive = false,
  ): void {
    if (previewMode.value || !document.value) {
      return
    }

    const root = document.value.canvasData.elements
    const hits = currentScopeChildren.value.filter(
      (element) =>
        isSelectableEditorElement(element) &&
        rectsIntersect(rect, getElementAbsoluteBounds(root, element.id)),
    )

    const hitIds = hits.map((element) => element.id)

    if (additive) {
      setSelection([...selectedElementIds.value, ...hitIds])
      return
    }

    setSelection(hitIds)
  }

  /** Enters isolation mode for a container: only its direct children become selectable/draggable. */
  function stepIntoGroupEditing(id: string): void {
    if (previewMode.value || !document.value) {
      return
    }

    const node = findNodeById(document.value.canvasData.elements, id)
    if (!node || !isGroupElement(node) || node.locked) {
      return
    }

    groupEditingPath.value = [...groupEditingPath.value, id]
    selectedElementIds.value = []
  }

  /** Exits one level of isolation (Escape / breadcrumb "up"), selecting the container just exited. */
  function exitGroupEditingLevel(): void {
    if (groupEditingPath.value.length === 0) {
      return
    }

    const exitedId = groupEditingPath.value[groupEditingPath.value.length - 1]
    groupEditingPath.value = groupEditingPath.value.slice(0, -1)
    selectedElementIds.value = [exitedId]
  }

  /** Exits isolation entirely (click fully outside the page/canvas chrome). */
  function exitGroupEditingToRoot(): void {
    groupEditingPath.value = []
  }

  /** Breadcrumb click on an arbitrary ancestor level. */
  function setGroupEditingPath(path: string[]): void {
    groupEditingPath.value = [...path]
    selectedElementIds.value = []
  }

  function applyPositionPatches(
    targets: PageElement[],
    patches: Map<string, { x?: number; y?: number }>,
    options?: { snap?: boolean },
  ): void {
    if (!document.value || targets.length === 0) {
      return
    }

    // Alignment/distribution only ever runs against siblings (resolveSelectionTarget clamps
    // multi-selection to a single scope level), so they all share one owning array/local frame.
    const root = document.value.canvasData.elements
    const location = locateNode(root, targets[0].id)
    if (!location) {
      return
    }

    const shouldSnap = options?.snap ?? false
    const targetIds = new Set(targets.map((element) => element.id))

    location.siblings.forEach((current, index) => {
      if (!targetIds.has(current.id)) {
        return
      }

      const patch = patches.get(current.id)
      if (!patch) {
        return
      }

      let x = patch.x !== undefined ? patch.x : current.position.x
      let y = patch.y !== undefined ? patch.y : current.position.y

      if (shouldSnap) {
        const snapped = snapPosition({ x, y })
        x = snapped.x
        y = snapped.y
      }

      if (x === current.position.x && y === current.position.y) {
        return
      }

      location.siblings[index] = {
        ...current,
        position: { x, y },
      } as PageElement
    })
  }

  function alignSelectedElements(mode: MultiAlignMode): void {
    if (!document.value || previewMode.value) {
      return
    }

    const targets = alignableSelectedElements.value
    if (targets.length < 2) {
      return
    }

    if (
      (mode === 'distribute-horizontal' || mode === 'distribute-vertical') &&
      targets.length < 3
    ) {
      return
    }

    pushHistoryImmediate()

    const patches = computeMultiElementAlignment(targets, mode)
    applyPositionPatches(targets, patches, { snap: true })
    isDirty.value = true
  }

  function applyDistributionGap(axis: 'horizontal' | 'vertical', gap: number): void {
    if (!document.value || previewMode.value) {
      return
    }

    const targets = alignableSelectedElements.value.map((element) => {
      const latest = findNodeById(document.value!.canvasData.elements, element.id)
      return latest ?? element
    })

    if (targets.length < 2 || !Number.isFinite(gap)) {
      return
    }

    scheduleDebouncedHistory()

    const patches =
      axis === 'horizontal'
        ? distributeWithFixedHorizontalGap(targets, gap)
        : distributeWithFixedVerticalGap(targets, gap)

    if (patches.size === 0) {
      return
    }

    applyPositionPatches(targets, patches, { snap: false })
    isDirty.value = true
  }

  function beginLiveTransform(): void {
    if (liveTransformActive.value || isApplyingHistory || !document.value) {
      return
    }

    pushHistoryImmediate()
    liveTransformActive.value = true
  }

  function finalizeLiveTransform(): void {
    if (!liveTransformActive.value) {
      return
    }

    liveTransformActive.value = false
    isDirty.value = true
  }

  function updateElement(
    id: string,
    patch: ElementPatch,
    options?: UpdateElementOptions,
  ): void {
    if (!document.value || previewMode.value) {
      return
    }

    if (options?.live) {
      beginLiveTransform()
    } else {
      if (liveTransformActive.value) {
        finalizeLiveTransform()
      }
      scheduleDebouncedHistory()
    }

    const location = locateNode(document.value.canvasData.elements, id)
    if (!location) {
      return
    }

    const current = location.node
    const nextPosition = patch.position ? { ...current.position, ...patch.position } : current.position
    const nextSize = patch.size ? { ...current.size, ...patch.size } : current.size
    location.siblings[location.index] = {
      ...current,
      ...patch,
      // Position and size are always whole pixels — drag/resize (from Konva's fractional pointer
      // coordinates) is the main source of non-integer values here; manual X/Y/W/H input is
      // rounded at the field level too, but rounding it again here is harmless and keeps this the
      // one place that guarantees it regardless of entry point.
      position: patch.position
        ? { x: Math.round(nextPosition.x), y: Math.round(nextPosition.y) }
        : current.position,
      size: patch.size
        ? { width: Math.round(nextSize.width), height: Math.round(nextSize.height) }
        : current.size,
    } as PageElement

    const updated = location.siblings[location.index]
    if (
      !options?.skipTextLayoutRecalc &&
      isTextPlaceholderType(updated.type) &&
      !(updated as TextPlaceholder).listRole
    ) {
      const textUpdated = updated as TextPlaceholder
      const metricsChanged = shouldRecalculateTextLayout(patch, updated)
      const widthEdited = patch.size?.width != null

      if (textFitMode.value === 'shrink' && (metricsChanged || patch.size != null)) {
        // The frame is whatever the patch just stored. Fit the font into it; do not move it.
        if (widthEdited) {
          location.siblings[location.index] = {
            ...textUpdated,
            textSizingMode: 'fixed',
          } as PageElement
        }
        refitTextFontToFrame(id, { adoptFontSize: Object.prototype.hasOwnProperty.call(patch, 'fontSize') })
      } else if (metricsChanged || widthEdited) {
        if (widthEdited && textUpdated.textSizingMode !== 'fixed') {
          location.siblings[location.index] = {
            ...textUpdated,
            textSizingMode: 'fixed',
          } as PageElement
        }
        // Typing only grows the box. A width the user just typed should hug the new wrap,
        // including getting shorter when the line count drops.
        recalculateTextElementSize(id, undefined, { fit: widthEdited ? 'hug' : 'grow' })
      } else if (patch.size?.height != null) {
        // A taller frame is kept, so vertical alignment has room. Shorter than the glyphs
        // grows back down — the template editor does not clip text.
        const contentHeight = measureKonvaText({
          text: resolveTextContent(textUpdated),
          element: textUpdated,
          maxWidth: Math.max(1, textUpdated.size.width),
        }).textHeight
        const height = Math.max(textUpdated.size.height, Math.ceil(contentHeight))
        if (height !== textUpdated.size.height) {
          const size = { width: textUpdated.size.width, height }
          location.siblings[location.index] = {
            ...textUpdated,
            size,
            position: positionForTopLeftAnchor(textUpdated.position, textUpdated.size, size, textUpdated.rotation),
          } as PageElement
        }
      }
    }

    if (!options?.live) {
      isDirty.value = true
    }
  }

  /** Reorders the children of `parentId` (or the root when null) — `orderedIds` must be a
   * permutation of that array's current ids; paint order = array order, no separate zIndex. */
  function reorderSiblings(parentId: string | null, orderedIds: string[]): void {
    if (!document.value || previewMode.value) {
      return
    }

    const root = document.value.canvasData.elements
    let siblings: PageElement[]

    if (parentId == null) {
      siblings = root
    } else {
      const parent = findNodeById(root, parentId)
      if (!parent || !isGroupElement(parent)) {
        return
      }
      siblings = parent.children
    }

    const currentIds = siblings.map((element) => element.id)
    if (
      orderedIds.length !== currentIds.length ||
      !orderedIds.every((id) => currentIds.includes(id))
    ) {
      return
    }

    pushHistoryImmediate()

    const byId = new Map(siblings.map((element) => [element.id, element]))
    const reordered = orderedIds.map((id) => byId.get(id)!)
    siblings.splice(0, siblings.length, ...reordered)

    isDirty.value = true
  }

  function moveElementLayer(id: string, direction: 'up' | 'down'): void {
    if (!document.value) {
      return
    }

    const location = locateNode(document.value.canvasData.elements, id)
    if (!location) {
      return
    }

    const targetIndex = direction === 'up' ? location.index + 1 : location.index - 1
    if (targetIndex < 0 || targetIndex >= location.siblings.length) {
      return
    }

    const orderedIds = location.siblings.map((element) => element.id)
    ;[orderedIds[location.index], orderedIds[targetIndex]] = [
      orderedIds[targetIndex],
      orderedIds[location.index],
    ]
    reorderSiblings(location.parent?.id ?? null, orderedIds)
  }

  /** General reparenting primitive — used by the layers panel drag&drop and internally by
   * group/ungroup. Preserves the node's absolute visual position/rotation across the move. */
  function moveElementToParent(id: string, newParentId: string | null, index: number): void {
    if (!document.value || previewMode.value || newParentId === id) {
      return
    }

    const root = document.value.canvasData.elements
    const location = locateNode(root, id)
    if (!location) {
      return
    }

    const node = location.node
    if (isGroupElement(node) && newParentId != null) {
      const descendantIds = new Set(getDescendants(node).map((descendant) => descendant.id))
      if (descendantIds.has(newParentId)) {
        return
      }
    }

    let newSiblings: PageElement[]
    if (newParentId == null) {
      newSiblings = root
    } else {
      const parent = findNodeById(root, newParentId)
      if (!parent || !isGroupElement(parent)) {
        return
      }
      newSiblings = parent.children
    }

    pushHistoryImmediate()

    const absoluteBox = getAbsoluteTransform(root, id)
    location.siblings.splice(location.index, 1)

    const newParentFrame = getContentFrameOf(root, newParentId)
    const local = absoluteToLocal(absoluteBox, newParentFrame)
    node.position = local.position
    node.rotation = local.rotation

    const clampedIndex = Math.max(0, Math.min(index, newSiblings.length))
    newSiblings.splice(clampedIndex, 0, node)

    isDirty.value = true
  }

  /** Creates a container in place of the current selection (>= 2 siblings) — visual position is
   * unchanged: the new group is axis-aligned (rotation 0) and each child's local position becomes
   * a plain offset from the group's own absolute top-left. */
  function groupSelection(): GroupElement | null {
    if (!document.value || previewMode.value) {
      return null
    }

    const ids = [...new Set(selectedElementIds.value)]
    if (ids.length < 2) {
      return null
    }

    const root = document.value.canvasData.elements
    const locations = ids
      .map((elementId) => locateNode(root, elementId))
      .filter((location): location is TreeLocation => location != null)

    if (locations.length < 2) {
      return null
    }

    const parentIds = new Set(locations.map((location) => location.parent?.id ?? null))
    if (parentIds.size > 1) {
      // Selection spans multiple containers — resolveSelectionTarget should prevent this,
      // but guard defensively rather than produce a group with mixed coordinate spaces.
      return null
    }

    pushHistoryImmediate()

    const siblings = locations[0].siblings
    const parentId = locations[0].parent?.id ?? null

    const bounds = ids.map((elementId) => getElementAbsoluteBounds(root, elementId))
    const minX = Math.min(...bounds.map((rect) => rect.x))
    const minY = Math.min(...bounds.map((rect) => rect.y))
    const maxX = Math.max(...bounds.map((rect) => rect.x + rect.width))
    const maxY = Math.max(...bounds.map((rect) => rect.y + rect.height))
    const groupSize: Size = { width: maxX - minX, height: maxY - minY }
    const groupAbsoluteBox: AbsoluteBox = { x: minX, y: minY, rotationDeg: 0 }
    const groupContentFrame = contentFrameOf(groupAbsoluteBox, groupSize)

    const orderedNodes = [...locations].sort((a, b) => a.index - b.index).map((location) => location.node)
    const children = orderedNodes.map((node) => {
      const absolute = getAbsoluteTransform(root, node.id)
      const local = absoluteToLocal(absolute, groupContentFrame)
      return { ...node, position: local.position, rotation: local.rotation }
    })

    const parentFrame = getContentFrameOf(root, parentId)
    const groupLocal = absoluteToLocal(groupAbsoluteBox, parentFrame)

    const group: GroupElement = {
      id: generateElementId('group'),
      type: 'group',
      name: 'Группа',
      position: groupLocal.position,
      rotation: groupLocal.rotation,
      size: groupSize,
      locked: false,
      visible: true,
      opacity: 1,
      children,
    }

    const idsToRemove = new Set(ids)
    let topmostOriginalIndex = -1
    const removedIndices: number[] = []
    for (let i = siblings.length - 1; i >= 0; i -= 1) {
      if (idsToRemove.has(siblings[i].id)) {
        removedIndices.push(i)
        if (i > topmostOriginalIndex) {
          topmostOriginalIndex = i
        }
        siblings.splice(i, 1)
      }
    }

    const removedBeforeInsert = removedIndices.filter((i) => i < topmostOriginalIndex).length
    const insertIndex = Math.max(0, topmostOriginalIndex - removedBeforeInsert)
    siblings.splice(insertIndex, 0, group)

    selectedElementIds.value = [group.id]
    isDirty.value = true
    return group
  }

  /** Dissolves a container: children are reparented to the group's own parent, preserving their
   * absolute visual position/rotation (general case — handles a group that was itself moved,
   * rotated, or resized before ungrouping). */
  function ungroupElement(id: string): PageElement[] | null {
    if (!document.value || previewMode.value) {
      return null
    }

    const root = document.value.canvasData.elements
    const location = locateNode(root, id)
    if (!location) {
      return null
    }

    const node = location.node
    if (!isGroupElement(node)) {
      return null
    }

    pushHistoryImmediate()

    const groupContentFrame = contentFrameOf(getAbsoluteTransform(root, id), node.size)
    const parentFrame = getContentFrameOf(root, location.parent?.id ?? null)

    const reparentedChildren = node.children.map((child) => {
      const childAbsolute = childBoxFromLocal(child, groupContentFrame)
      const local = absoluteToLocal(childAbsolute, parentFrame)
      return { ...child, position: local.position, rotation: local.rotation }
    })

    location.siblings.splice(location.index, 1, ...reparentedChildren)

    selectedElementIds.value = reparentedChildren.map((child) => child.id)
    if (groupEditingId.value === id) {
      groupEditingPath.value = groupEditingPath.value.slice(0, -1)
    }
    isDirty.value = true
    return reparentedChildren
  }

  function renameElement(id: string, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }

    updateElement(id, { name: trimmed })
  }

  function setElementVisible(id: string, visible: boolean): void {
    updateElement(id, { visible })
  }

  function setElementLocked(id: string, locked: boolean): void {
    updateElement(id, { locked })
  }

  function startTextEditing(id: string): void {
    if (previewMode.value) {
      return
    }

    const element = document.value ? findNodeById(document.value.canvasData.elements, id) : null
    if (!element || !isTextPlaceholderType(element.type) || element.locked) {
      return
    }

    textEditingElementId.value = id
    selectedElementIds.value = [id]
  }

  function stopTextEditing(): void {
    textEditingElementId.value = null
  }

  function setPhotoDropTarget(id: string | null): void {
    photoDropTargetId.value = id
  }

  function setPhotoImage(elementId: string, url: string): void {
    updateElement(elementId, {
      defaultImageUrl: toStoredAssetPath(url) ?? url,
      cropX: 0,
      cropY: 0,
      imageScale: 1,
    })
  }

  function updatePhotoCrop(
    elementId: string,
    patch: Partial<PhotoCropState>,
    options?: UpdateElementOptions,
  ): void {
    const element = document.value ? findNodeById(document.value.canvasData.elements, elementId) : null
    if (!element || element.type !== 'photo-placeholder') {
      return
    }

    const photo = element as PhotoPlaceholder
    const dimensions = photoImageDimensions.value[elementId]

    if (!dimensions) {
      updateElement(elementId, patch, options)
      return
    }

    const box = getPhotoRenderBox(photo.frame, photo.size.width, photo.size.height)
    const nextCrop = clampPhotoCrop(
      box.width,
      box.height,
      dimensions.width,
      dimensions.height,
      resolvePhotoRenderFitMode(photo.fitMode),
      {
        cropX: patch.cropX ?? photo.cropX,
        cropY: patch.cropY ?? photo.cropY,
        imageScale: patch.imageScale ?? photo.imageScale,
      },
    )

    updateElement(
      elementId,
      {
        cropX: nextCrop.cropX,
        cropY: nextCrop.cropY,
        imageScale: nextCrop.imageScale,
      },
      options,
    )
  }

  function resetPhotoCropOnResize(elementId: string, options?: UpdateElementOptions): void {
    updateElement(
      elementId,
      {
        cropX: 0,
        cropY: 0,
        imageScale: 1,
      },
      options,
    )
  }

  const photoImageDimensions = ref<Record<string, { width: number; height: number }>>({})

  function registerPhotoImageDimensions(
    elementId: string,
    dimensions: { width: number; height: number },
  ): void {
    photoImageDimensions.value = {
      ...photoImageDimensions.value,
      [elementId]: dimensions,
    }
  }

  function startPhotoCropEditing(id: string): void {
    if (previewMode.value) {
      return
    }

    const element = document.value ? findNodeById(document.value.canvasData.elements, id) : null
    if (
      !element ||
      element.type !== 'photo-placeholder' ||
      element.locked ||
      !(element as PhotoPlaceholder).defaultImageUrl
    ) {
      return
    }

    exitAllEditingModes()
    photoCropEditingElementId.value = id
    selectedElementIds.value = [id]
  }

  function stopPhotoCropEditing(): void {
    photoCropEditingElementId.value = null
    pageBackgroundCropEditing.value = false
  }

  const pageBackgroundImageDimensions = ref<{ width: number; height: number } | null>(null)

  function registerPageBackgroundImageDimensions(dimensions: {
    width: number
    height: number
  }): void {
    pageBackgroundImageDimensions.value = dimensions
  }

  function updatePageBackgroundCrop(
    patch: Partial<PhotoCropState>,
    options?: UpdateElementOptions,
  ): void {
    if (!document.value) {
      return
    }

    if (options?.live) {
      beginLiveTransform()
    } else if (liveTransformActive.value) {
      finalizeLiveTransform()
    } else {
      pushHistoryImmediate()
    }

    const dimensions = pageBackgroundImageDimensions.value
    const target = pageBackgroundCropTarget.value
    const frameWidth =
      target === 'left' || target === 'right' ? A4_PAGE_WIDTH : document.value.width
    const frameHeight = document.value.height
    const current = readPageBackgroundSettings(target)

    const nextCrop = {
      cropX: patch.cropX ?? current.backgroundImageCropX,
      cropY: patch.cropY ?? current.backgroundImageCropY,
      imageScale: patch.imageScale ?? current.backgroundImageScale,
    }

    const clamped =
      dimensions != null
        ? clampPhotoCrop(
            frameWidth,
            frameHeight,
            dimensions.width,
            dimensions.height,
            resolvePhotoRenderFitMode(current.backgroundImageFit),
            nextCrop,
          )
        : nextCrop

    applyPageBackgroundPatch(target, {
      backgroundImageCropX: clamped.cropX,
      backgroundImageCropY: clamped.cropY,
      backgroundImageScale: clamped.imageScale,
    })
    isDirty.value = true
  }

  function startPageBackgroundCropEditing(
    targetOverride?: PageBackgroundEditTarget,
  ): void {
    if (!document.value || previewMode.value) {
      return
    }

    let target = targetOverride ?? getPageBackgroundEditTarget()

    if (
      (target === 'left' || target === 'right') &&
      isSpreadPageType(document.value.pageType) &&
      document.value.spreadBackgroundMode === 'per-page'
    ) {
      activeSpreadBackgroundSide.value = target
    } else if (target === 'left' || target === 'right') {
      target = 'spread'
    }

    const background = readPageBackgroundSettings(target)
    if (!background.backgroundImageUrl) {
      return
    }

    exitAllEditingModes()
    pageBackgroundCropTarget.value = target
    pageBackgroundCropEditing.value = true
    selectedElementIds.value = []
  }

  function stopPageBackgroundCropEditing(): void {
    pageBackgroundCropEditing.value = false
    pageBackgroundCropTarget.value = getPageBackgroundEditTarget()
    syncCanvasMeta()
  }

  function startPhotoDim(id: string): void {
    if (previewMode.value) {
      return
    }

    const element = document.value ? findNodeById(document.value.canvasData.elements, id) : null
    if (
      !element ||
      element.type !== 'photo-placeholder' ||
      element.locked ||
      !(element as PhotoPlaceholder).defaultImageUrl
    ) {
      return
    }

    exitAllEditingModes()
    photoDimElementId.value = id
    selectedElementIds.value = [id]
  }

  function zoomPageBackgroundCrop(
    scaleDelta: number,
    focalPagePoint?: { x: number; y: number },
  ): void {
    if (!document.value || !pageBackgroundCropEditing.value) {
      return
    }

    const target = pageBackgroundCropTarget.value
    const frameWidth =
      target === 'left' || target === 'right' ? A4_PAGE_WIDTH : document.value.width
    const frameX = target === 'right' ? A4_PAGE_WIDTH : 0
    const settings = readPageBackgroundSettings(target)
    const fitMode = resolvePhotoRenderFitMode(settings.backgroundImageFit)
    const dimensions = pageBackgroundImageDimensions.value

    if (fitMode === 'fill') {
      return
    }

    if (!dimensions) {
      updatePageBackgroundCrop({
        imageScale: settings.backgroundImageScale + scaleDelta,
      })
      return
    }

    const focalLocal = focalPagePoint
      ? {
          x: focalPagePoint.x - frameX,
          y: focalPagePoint.y,
        }
      : {
          x: frameWidth / 2,
          y: document.value.height / 2,
        }

    const nextCrop = computePhotoCropZoomAtPoint(
      frameWidth,
      document.value.height,
      dimensions.width,
      dimensions.height,
      fitMode,
      getPageBackgroundCropState({
        cropX: settings.backgroundImageCropX,
        cropY: settings.backgroundImageCropY,
        imageScale: settings.backgroundImageScale,
      }),
      focalLocal.x,
      focalLocal.y,
      scaleDelta,
    )

    updatePageBackgroundCrop(nextCrop)
  }

  function stopPhotoDim(): void {
    photoDimElementId.value = null
  }

  function zoomPhotoReposition(
    scaleDelta: number,
    focalPagePoint?: { x: number; y: number },
  ): void {
    const elementId = photoDimElementId.value
    if (!elementId || !document.value) {
      return
    }

    const element = findNodeById(document.value.canvasData.elements, elementId)
    if (!element || element.type !== 'photo-placeholder') {
      return
    }

    const photo = element as PhotoPlaceholder
    const dimensions = photoImageDimensions.value[elementId]
    const renderMode = resolvePhotoRenderFitMode(photo.fitMode)

    if (renderMode === 'fill') {
      return
    }

    if (!dimensions) {
      updatePhotoCrop(elementId, {
        imageScale: photo.imageScale + scaleDelta,
      })
      return
    }

    const box = getPhotoRenderBox(photo.frame, photo.size.width, photo.size.height)

    const focalLocal = focalPagePoint
      ? (() => {
          const elementLocal = pagePointToPhotoLocal(
            photo.size.width,
            photo.size.height,
            photo.position,
            photo.rotation,
            focalPagePoint.x,
            focalPagePoint.y,
          )
          return { x: elementLocal.x - box.x, y: elementLocal.y - box.y }
        })()
      : {
          x: box.width / 2,
          y: box.height / 2,
        }

    const nextCrop = computePhotoCropZoomAtPoint(
      box.width,
      box.height,
      dimensions.width,
      dimensions.height,
      photo.fitMode,
      getPhotoCropState(photo),
      focalLocal.x,
      focalLocal.y,
      scaleDelta,
    )

    updatePhotoCrop(elementId, nextCrop)
  }

  function undo(): void {
    if (!document.value) {
      return
    }

    if (debouncedHistorySnapshot) {
      if (historyDebounceTimer) {
        clearTimeout(historyDebounceTimer)
        historyDebounceTimer = null
      }

      historyFuture.value.unshift(createSnapshot())
      applySnapshot(debouncedHistorySnapshot)
      debouncedHistorySnapshot = null
      return
    }

    if (historyPast.value.length === 0) {
      return
    }

    historyFuture.value.unshift(createSnapshot())
    const snapshot = historyPast.value.pop()
    if (snapshot) {
      applySnapshot(snapshot)
    }
  }

  function redo(): void {
    flushDebouncedHistory()

    if (historyFuture.value.length === 0 || !document.value) {
      return
    }

    historyPast.value.push(createSnapshot())
    const snapshot = historyFuture.value.shift()
    if (snapshot) {
      applySnapshot(snapshot)
    }
  }

  function setPreviewMode(value: boolean): void {
    previewMode.value = value
    if (value) {
      selectedElementIds.value = []
      photoDimElementId.value = null
      photoCropEditingElementId.value = null
    }
  }

  function togglePreviewMode(): void {
    setPreviewMode(!previewMode.value)
  }

  function setCanvasZoom(value: number): void {
    canvasZoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  }

  function zoomIn(): void {
    setCanvasZoom(canvasZoom.value + 0.1)
  }

  function zoomOut(): void {
    setCanvasZoom(canvasZoom.value - 0.1)
  }

  function resetCanvasZoom(): void {
    canvasZoom.value = 1
  }

  function setViewportPan(x: number, y: number): void {
    viewportPanX.value = x
    viewportPanY.value = y
  }

  function resetViewport(): void {
    viewportPanX.value = 0
    viewportPanY.value = 0
    canvasZoom.value = 1
  }

  function setMobileDockOccludedHeight(px: number): void {
    mobileDockOccludedHeight.value = px
  }

  function toggleSnapToGrid(): void {
    snapToGridEnabled.value = !snapToGridEnabled.value
  }

  function setSnapGridSize(size: number): void {
    if (size > 0) {
      snapGridSize.value = size
    }
  }

  function setSmartGuideLines(lines: SmartGuideLines): void {
    smartGuideLines.value = lines
  }

  function clearSmartGuideLines(): void {
    smartGuideLines.value = { vertical: [], horizontal: [], spreadSide: null }
  }

  function toggleSmartGuides(): void {
    smartGuidesEnabled.value = !smartGuidesEnabled.value
    if (!smartGuidesEnabled.value) {
      clearSmartGuideLines()
    }
  }

  function togglePrintSafeZone(): void {
    printSafeZoneEnabled.value = !printSafeZoneEnabled.value
  }

  function snapCoordinate(value: number): number {
    if (!snapToGridEnabled.value) {
      return value
    }

    return snapCoordinateUtil(value, snapGridSize.value)
  }

  function snapPosition(position: Position): Position {
    if (!snapToGridEnabled.value) {
      return position
    }

    return snapPositionUtil(position, snapGridSize.value)
  }

  function alignElementToPageCenter(
    id: string,
    axis: 'horizontal' | 'vertical' | 'both',
  ): void {
    if (!document.value || previewMode.value) {
      return
    }

    const element = findNodeById(document.value.canvasData.elements, id)
    if (!element || element.locked) {
      return
    }

    pushHistoryImmediate()

    const nextPosition = getPageCenterPosition(
      document.value.width,
      document.value.height,
      element.size.width,
      element.size.height,
      axis,
      element.position,
    )

    element.position = snapPosition(nextPosition)
    isDirty.value = true
  }

  function alignSelectedToPageCenter(axis: 'horizontal' | 'vertical' | 'both'): void {
    if (selectedElementIds.value.length !== 1) {
      return
    }

    alignElementToPageCenter(selectedElementIds.value[0], axis)
  }

  function allowPrintCropViolation(): void {
    if (!document.value || previewMode.value) {
      return
    }

    const elementsForCheck = flattenTree(elements.value, liveDragPositions.value)

    const violating = elementsForCheck.filter((element) =>
      elementIntersectsPrintCropZone(element, pageWidth.value, pageHeight.value),
    )

    if (violating.length === 0) {
      return
    }

    pushHistoryImmediate()

    for (const element of violating) {
      updateElement(element.id, { printCropAllowed: true })
    }
  }

  /** Persists edits back to wherever the document came from — set by `fetchAndLoad`, called by
   * `saveCanvas`. A plain closure variable (like `isApplyingHistory` above), not a ref: it's a
   * wiring detail of the current editor session, not document state. */
  let saveDocument: ((canvasData: CanvasData) => Promise<void>) | null = null

  async function fetchAndLoad(
    fetchDocument: () => Promise<EditorSourceDocument>,
    saveFn: (canvasData: CanvasData) => Promise<void>,
  ): Promise<void> {
    loading.value = true
    try {
      const source = await fetchDocument()
      saveDocument = saveFn
      loadDocument(source)
    } finally {
      loading.value = false
    }
  }

  async function saveCanvas(): Promise<void> {
    if (!document.value || !saveDocument) {
      return
    }

    flushDebouncedHistory()
    saving.value = true
    try {
      syncCanvasMeta()
      await saveDocument(document.value.canvasData)
      isDirty.value = false
    } finally {
      saving.value = false
    }
  }

  function reset(): void {
    document.value = null
    saveDocument = null
    selectedElementIds.value = []
    groupEditingPath.value = []
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    pageBackgroundCropEditing.value = false
    pageBackgroundCropTarget.value = 'spread'
    activeSpreadBackgroundSide.value = 'left'
    photoDimElementId.value = null
    photoDropTargetId.value = null
    photoImageDimensions.value = {}
    pageBackgroundImageDimensions.value = null
    liveDragPositions.value = {}
    previewMode.value = false
    textFitMode.value = 'grow'
    canvasZoom.value = 1
    snapToGridEnabled.value = true
    snapGridSize.value = DEFAULT_SNAP_GRID_SIZE
    smartGuidesEnabled.value = true
    printSafeZoneEnabled.value = false
    clearSmartGuideLines()
    isDirty.value = false
    clearHistory()
  }

  return {
    document,
    selectedElementIds,
    selectedElementId,
    loading,
    saving,
    isDirty,
    previewMode,
    canvasZoom,
    viewportPanX,
    viewportPanY,
    mobileDockOccludedHeight,
    snapToGridEnabled,
    snapGridSize,
    smartGuidesEnabled,
    smartGuideLines,
    printSafeZoneEnabled,
    textEditingElementId,
    photoCropEditingElementId,
    pageBackgroundCropEditing,
    pageBackgroundCropTarget,
    photoDimElementId,
    photoDropTargetId,
    elements,
    flatElements,
    groupEditingId,
    groupEditingPath,
    groupEditingBreadcrumb,
    selectedElement,
    selectedElements,
    alignableSelectedElements,
    isMultiSelection,
    hasSelection,
    selectionCount,
    isElementSelected,
    showPropertiesPanel,
    requestPageProperties,
    dismissPageProperties,
    closePropertiesPanel,
    multiSelectMode,
    enterMultiSelectMode,
    exitMultiSelectMode,
    pageWidth,
    pageHeight,
    backgroundColor,
    backgroundImageUrl,
    backgroundImageFit,
    backgroundImageCropX,
    backgroundImageCropY,
    backgroundImageScale,
    spreadBackgroundMode,
    leftPageBackground,
    rightPageBackground,
    editablePageBackground,
    editablePageBackgroundTarget,
    pageBackgroundCropEditingKey,
    pageBackgroundCropSettings,
    activeSpreadBackgroundSide,
    templateName,
    isSpreadPage,
    printCropZoneViolation,
    liveDragPositions,
    liveTransformActive,
    canUndo,
    canRedo,
    addElement,
    addFramedPhoto,
    duplicateElement,
    hasClipboardContent,
    copySelection,
    pasteClipboard,
    updateAiTextShared,
    findListOf,
    findListById,
    makeList,
    addToList,
    removeList,
    removeListRow,
    setListQuestion,
    setListMinItems,
    setListMode,
    setListSuggestSettings,
    setListFlowSettings,
    setListTextLimit,
    setListSlots,
    setListRole,
    applyListRowStyle,
    moveListRow,
    reverseListRows,
    addAiTextChainPart,
    addCoverPhrase,
    unlinkAiTextChainPart,
    moveAiTextChainPart,
    removeElement,
    removeSelectedElements,
    selectElement,
    selectFromLayersPanel,
    toggleElementSelection,
    setSelection,
    clearSelection,
    exitAllEditingModes,
    selectElementsInRect,
    stepIntoGroupEditing,
    exitGroupEditingLevel,
    exitGroupEditingToRoot,
    setGroupEditingPath,
    groupSelection,
    ungroupElement,
    moveElementToParent,
    renameElement,
    getRemovalImpactCount,
    alignSelectedElements,
    applyDistributionGap,
    updateElement,
    textFitMode,
    setTextFitMode,
    recalculateTextElementSize,
    refitTextFontToFrame,
    setLiveDragPosition,
    setLiveDragPositions,
    clearLiveDragPosition,
    clearLiveDragPositions,
    moveElementsPositions,
    finalizeLiveTransform,
    startTextEditing,
    stopTextEditing,
    setPhotoDropTarget,
    setPhotoImage,
    updatePhotoCrop,
    resetPhotoCropOnResize,
    registerPhotoImageDimensions,
    startPhotoCropEditing,
    stopPhotoCropEditing,
    registerPageBackgroundImageDimensions,
    updatePageBackgroundCrop,
    startPageBackgroundCropEditing,
    stopPageBackgroundCropEditing,
    zoomPageBackgroundCrop,
    startPhotoDim,
    stopPhotoDim,
    zoomPhotoReposition,
    updatePageSettings,
    setSpreadBackgroundMode,
    setActiveSpreadBackgroundSide,
    reorderSiblings,
    moveElementLayer,
    setElementVisible,
    setElementLocked,
    undo,
    redo,
    setPreviewMode,
    togglePreviewMode,
    setCanvasZoom,
    zoomIn,
    zoomOut,
    resetCanvasZoom,
    setViewportPan,
    resetViewport,
    setMobileDockOccludedHeight,
    toggleSnapToGrid,
    setSnapGridSize,
    setSmartGuideLines,
    clearSmartGuideLines,
    toggleSmartGuides,
    togglePrintSafeZone,
    snapCoordinate,
    snapPosition,
    alignElementToPageCenter,
    alignSelectedToPageCenter,
    allowPrintCropViolation,
    fetchAndLoad,
    saveCanvas,
    reset,
  }
})
