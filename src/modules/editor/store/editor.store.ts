import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SNAP_GRID_SIZE,
} from '../constants/page.constants'
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
import {
  getElementSelectionBounds,
  isSelectableEditorElement,
} from '../utils/element-bounds.util'
import { createElementFromLibrary } from '../factories/create-element.factory'
import type { LibraryElementType } from '../factories/create-element.factory'
import type { AdminMagazinePage } from '@/shared/api/admin/magazine-pages.api'
import { adminMagazinePagesApi } from '@/shared/api/admin/magazine-pages.api'
import type { PageElement } from '../models'
import type { EditorDocument } from '../models/page-template.model'
import { normalizeCanvasData } from '../models/canvas-data.model'
import type { Position, Size } from '../models/geometry.model'
import type { TextPlaceholder } from '../models/text-placeholder.model'
import type { PhotoPlaceholder } from '../models/photo-placeholder.model'
import { isSpreadPageType } from '../utils/spread.util'
import { isTextPlaceholderType } from '../utils/normalize-text-placeholder.util'
import {
  recalculateTextLayout,
  shouldRecalculateTextLayout,
} from '../utils/text-layout.util'
import {
  clampPhotoCrop,
  computePhotoCropZoomAtPoint,
  getPhotoCropState,
  pagePointToPhotoLocal,
  resolvePhotoRenderFitMode,
  type PhotoCropState,
} from '../utils/photo-crop.util'

export type ElementPatch = {
  position?: Partial<Position>
  size?: Partial<Size>
} & Record<string, unknown>

export interface UpdateElementOptions {
  live?: boolean
}

export interface PageSettingsPatch {
  width?: number
  height?: number
  backgroundColor?: string
}

interface CanvasSnapshot {
  width: number
  height: number
  backgroundColor: string
  elements: PageElement[]
}

const MAX_HISTORY = 50
const HISTORY_DEBOUNCE_MS = 500
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

let elementDuplicateCounter = 0

function cloneElementForDuplicate(element: PageElement, zIndex: number): PageElement {
  elementDuplicateCounter += 1
  const clone = JSON.parse(JSON.stringify(element)) as PageElement
  clone.id = `${element.type}-copy-${Date.now()}-${elementDuplicateCounter}`
  clone.name = `${element.name} (копия)`
  clone.position = {
    x: element.position.x + 20,
    y: element.position.y + 20,
  }
  clone.zIndex = zIndex
  clone.locked = false
  return clone
}

export const useEditorStore = defineStore('editor', () => {
  const document = ref<EditorDocument | null>(null)
  const selectedElementIds = ref<string[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const isDirty = ref(false)
  const previewMode = ref(false)
  const canvasZoom = ref(1)
  const snapToGridEnabled = ref(true)
  const snapGridSize = ref(DEFAULT_SNAP_GRID_SIZE)
  const smartGuidesEnabled = ref(true)
  const smartGuideLines = ref<SmartGuideLines>({ vertical: [], horizontal: [], spreadSide: null })
  const printSafeZoneEnabled = ref(false)
  const textEditingElementId = ref<string | null>(null)
  const photoCropEditingElementId = ref<string | null>(null)
  const photoDimElementId = ref<string | null>(null)
  const photoDropTargetId = ref<string | null>(null)
  const liveDragPositions = ref<Record<string, Position>>({})

  const historyPast = ref<CanvasSnapshot[]>([])
  const historyFuture = ref<CanvasSnapshot[]>([])

  let isApplyingHistory = false
  let debouncedHistorySnapshot: CanvasSnapshot | null = null
  let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let liveTransformActive = ref(false)

  const elements = computed(() =>
    [...(document.value?.canvasData.elements ?? [])].sort((a, b) => a.zIndex - b.zIndex),
  )

  const layers = computed(() => [...elements.value].reverse())

  const selectedElementId = computed(() => selectedElementIds.value[0] ?? null)

  const selectedElement = computed(() => {
    if (selectedElementIds.value.length !== 1) {
      return null
    }

    return (
      document.value?.canvasData.elements.find(
        (element) => element.id === selectedElementIds.value[0],
      ) ?? null
    )
  })

  const selectedElements = computed(() =>
    selectedElementIds.value
      .map((id) => document.value?.canvasData.elements.find((element) => element.id === id))
      .filter((element): element is PageElement => element != null),
  )

  const alignableSelectedElements = computed(() =>
    selectedElements.value.filter((element) => !element.locked && element.visible),
  )

  const isMultiSelection = computed(() => selectedElementIds.value.length >= 2)
  const hasSelection = computed(() => selectedElementIds.value.length > 0)
  const selectionCount = computed(() => selectedElementIds.value.length)

  function isElementSelected(id: string): boolean {
    return selectedElementIds.value.includes(id)
  }

  const nextZIndex = computed(
    () =>
      (document.value?.canvasData.elements ?? []).reduce(
        (max, element) => Math.max(max, element.zIndex),
        0,
      ) + 1,
  )

  const pageWidth = computed(() => document.value?.width ?? A4_PAGE_WIDTH)
  const pageHeight = computed(() => document.value?.height ?? A4_PAGE_HEIGHT)
  const backgroundColor = computed(
    () => document.value?.backgroundColor ?? DEFAULT_PAGE_BACKGROUND,
  )
  const templateName = computed(() => document.value?.name ?? 'Страница')

  const isSpreadPage = computed(() => isSpreadPageType(document.value?.pageType))

  const printCropZoneViolation = computed(() => {
    if (previewMode.value) {
      return false
    }

    const elementsForCheck = elements.value.map((element) => {
      const livePosition = liveDragPositions.value[element.id]

      if (!livePosition) {
        return element
      }

      return {
        ...element,
        position: livePosition,
      }
    })

    return hasElementsInPrintCropZone(
      elementsForCheck,
      pageWidth.value,
      pageHeight.value,
    )
  })

  const canUndo = computed(() => historyPast.value.length > 0 || debouncedHistorySnapshot !== null)
  const canRedo = computed(() => historyFuture.value.length > 0)

  function createSnapshot(): CanvasSnapshot {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    return JSON.parse(
      JSON.stringify({
        width: document.value.width,
        height: document.value.height,
        backgroundColor: document.value.backgroundColor,
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
    document.value.canvasData.elements = snapshot.elements
    syncCanvasMeta()

    if (selectedElementIds.value.length > 0) {
      const validIds = new Set(snapshot.elements.map((element) => element.id))
      selectedElementIds.value = selectedElementIds.value.filter((id) => validIds.has(id))
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
  }

  function loadFromApi(page: AdminMagazinePage): void {
    const canvasData = normalizeCanvasData(page.canvasData)

    if (isSpreadPageType(page.pageType)) {
      canvasData.pageWidth = A4_SPREAD_PAGE_WIDTH
      canvasData.pageHeight = A4_SPREAD_PAGE_HEIGHT
    }

    document.value = {
      magazineTypeId: page.magazineTypeId,
      magazinePageId: page.id,
      name: page.name,
      pageType: page.pageType,
      width: canvasData.pageWidth ?? A4_PAGE_WIDTH,
      height: canvasData.pageHeight ?? A4_PAGE_HEIGHT,
      backgroundColor: canvasData.backgroundColor ?? DEFAULT_PAGE_BACKGROUND,
      canvasData,
    }
    selectedElementIds.value = []
    liveDragPositions.value = {}
    previewMode.value = false
    canvasZoom.value = 1
    isDirty.value = false
    clearHistory()

    for (const element of document.value.canvasData.elements) {
      if (isTextPlaceholderType(element.type)) {
        recalculateTextElementSize(element.id)
      }
    }
  }

  function updatePageSettings(patch: PageSettingsPatch): void {
    if (!document.value) {
      return
    }

    if (isSpreadPageType(document.value.pageType)) {
      return
    }

    pushHistoryImmediate()

    if (patch.width !== undefined) {
      document.value.width = Math.max(100, patch.width)
    }
    if (patch.height !== undefined) {
      document.value.height = Math.max(100, patch.height)
    }
    if (patch.backgroundColor !== undefined) {
      document.value.backgroundColor = patch.backgroundColor
    }

    syncCanvasMeta()
    isDirty.value = true
  }

  function recalculateTextElementSize(
    id: string,
    displayText?: string | null,
    options?: { adjustAnchor?: boolean },
  ): void {
    if (!document.value) {
      return
    }

    const index = document.value.canvasData.elements.findIndex((element) => element.id === id)
    if (index === -1) {
      return
    }

    const element = document.value.canvasData.elements[index]
    if (!isTextPlaceholderType(element.type)) {
      return
    }

    const layout = recalculateTextLayout({
      element: element as TextPlaceholder,
      displayText,
      pageWidth: document.value.width,
      pageHeight: document.value.height,
      adjustAnchor: options?.adjustAnchor ?? false,
    })

    document.value.canvasData.elements[index] = {
      ...element,
      size: layout.size,
      position:
        options?.adjustAnchor && layout.position
          ? { ...element.position, ...layout.position }
          : element.position,
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

    const patchMap = new Map(patches.map((patch) => [patch.id, patch.position]))
    const textIdsToRecalculate: string[] = []

    document.value.canvasData.elements = document.value.canvasData.elements.map((element) => {
      const nextPosition = patchMap.get(element.id)

      if (!nextPosition) {
        return element
      }

      if (isTextPlaceholderType(element.type)) {
        textIdsToRecalculate.push(element.id)
      }

      return {
        ...element,
        position: nextPosition,
      } as PageElement
    })

    for (const id of textIdsToRecalculate) {
      recalculateTextElementSize(id)
    }

    isDirty.value = true
  }

  function addElement(type: LibraryElementType): PageElement {
    if (!document.value) {
      throw new Error('Editor document is not loaded')
    }

    pushHistoryImmediate()

    const element = createElementFromLibrary(
      type,
      nextZIndex.value,
      document.value.width,
      document.value.height,
    )
    document.value.canvasData.elements.push(element)
    if (isTextPlaceholderType(element.type)) {
      recalculateTextElementSize(element.id)

      if (typeof globalThis.document !== 'undefined') {
        void globalThis.document.fonts.ready.then(() => {
          recalculateTextElementSize(element.id)
        })
      }
    }
    selectedElementIds.value = [element.id]
    isDirty.value = true
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

    const clones: PageElement[] = []
    let zIndex = nextZIndex.value

    for (const sourceId of sourceIds) {
      const source = document.value.canvasData.elements.find((element) => element.id === sourceId)
      if (!source) {
        continue
      }

      const clone = cloneElementForDuplicate(source, zIndex)
      clone.position = {
        x: source.position.x + 20,
        y: source.position.y + 20,
      }
      document.value.canvasData.elements.push(clone)
      if (isTextPlaceholderType(clone.type)) {
        recalculateTextElementSize(clone.id)
      }
      clones.push(clone)
      zIndex += 1
    }

    if (clones.length === 0) {
      return null
    }

    selectedElementIds.value = clones.map((clone) => clone.id)
    isDirty.value = true
    return clones[clones.length - 1]
  }

  function removeElement(id: string): void {
    if (!document.value || previewMode.value) {
      return
    }

    pushHistoryImmediate()

    document.value.canvasData.elements = document.value.canvasData.elements.filter(
      (element) => element.id !== id,
    )

    selectedElementIds.value = selectedElementIds.value.filter((selectedId) => selectedId !== id)
    isDirty.value = true
  }

  function removeSelectedElements(): void {
    if (!document.value || previewMode.value || selectedElementIds.value.length === 0) {
      return
    }

    pushHistoryImmediate()

    const idsToRemove = new Set(selectedElementIds.value)
    document.value.canvasData.elements = document.value.canvasData.elements.filter(
      (element) => !idsToRemove.has(element.id),
    )
    selectedElementIds.value = []
    isDirty.value = true
  }

  function clearSelection(): void {
    selectedElementIds.value = []
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    photoDimElementId.value = null
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

    selectedElementIds.value = id ? [id] : []
  }

  function toggleElementSelection(id: string): void {
    if (previewMode.value) {
      return
    }

    if (selectedElementIds.value.includes(id)) {
      selectedElementIds.value = selectedElementIds.value.filter((selectedId) => selectedId !== id)
      return
    }

    selectedElementIds.value = [...selectedElementIds.value, id]
  }

  function selectElementsInRect(
    rect: { x: number; y: number; width: number; height: number },
    additive = false,
  ): void {
    if (previewMode.value) {
      return
    }

    const hits = elements.value.filter(
      (element) =>
        isSelectableEditorElement(element) &&
        rectsIntersect(rect, getElementSelectionBounds(element)),
    )

    const hitIds = hits.map((element) => element.id)

    if (additive) {
      setSelection([...selectedElementIds.value, ...hitIds])
      return
    }

    setSelection(hitIds)
  }

  function applyPositionPatches(
    targets: PageElement[],
    patches: Map<string, { x?: number; y?: number }>,
    options?: { snap?: boolean },
  ): void {
    if (!document.value) {
      return
    }

    const shouldSnap = options?.snap ?? false
    const targetIds = new Set(targets.map((element) => element.id))

    const nextElements = document.value.canvasData.elements.map((current) => {
      if (!targetIds.has(current.id)) {
        return current
      }

      const patch = patches.get(current.id)
      if (!patch) {
        return current
      }

      let x = patch.x !== undefined ? patch.x : current.position.x
      let y = patch.y !== undefined ? patch.y : current.position.y

      if (shouldSnap) {
        const snapped = snapPosition({ x, y })
        x = snapped.x
        y = snapped.y
      }

      if (x === current.position.x && y === current.position.y) {
        return current
      }

      return {
        ...current,
        position: { x, y },
      } as PageElement
    })

    document.value = {
      ...document.value,
      canvasData: {
        ...document.value.canvasData,
        elements: nextElements,
      },
    }
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
      const latest = document.value!.canvasData.elements.find((item) => item.id === element.id)
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

    const index = document.value.canvasData.elements.findIndex((element) => element.id === id)
    if (index === -1) {
      return
    }

    const current = document.value.canvasData.elements[index]
    document.value.canvasData.elements[index] = {
      ...current,
      ...patch,
      position: patch.position ? { ...current.position, ...patch.position } : current.position,
      size: patch.size ? { ...current.size, ...patch.size } : current.size,
    } as PageElement

    const updated = document.value.canvasData.elements[index]
    if (shouldRecalculateTextLayout(patch, updated)) {
      recalculateTextElementSize(id, undefined, { adjustAnchor: true })
    }

    if (!options?.live) {
      isDirty.value = true
    }
  }

  function reorderElements(orderedIds: string[]): void {
    if (!document.value || previewMode.value) {
      return
    }

    const currentIds = elements.value.map((element) => element.id)
    if (
      orderedIds.length !== currentIds.length ||
      !orderedIds.every((id) => currentIds.includes(id))
    ) {
      return
    }

    pushHistoryImmediate()

    orderedIds.forEach((id, index) => {
      const element = document.value!.canvasData.elements.find((item) => item.id === id)
      if (element) {
        element.zIndex = index
      }
    })

    isDirty.value = true
  }

  function moveElementLayer(id: string, direction: 'up' | 'down'): void {
    const ordered = elements.value.map((element) => element.id)
    const index = ordered.indexOf(id)
    if (index === -1) {
      return
    }

    const targetIndex = direction === 'up' ? index + 1 : index - 1
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return
    }

    const nextOrder = [...ordered]
    ;[nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]]
    reorderElements(nextOrder)
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

    const element = document.value?.canvasData.elements.find((item) => item.id === id)
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
      defaultImageUrl: url,
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
    const element = document.value?.canvasData.elements.find((item) => item.id === elementId)
    if (!element || element.type !== 'photo-placeholder') {
      return
    }

    const photo = element as PhotoPlaceholder
    const dimensions = photoImageDimensions.value[elementId]

    if (!dimensions) {
      updateElement(elementId, patch, options)
      return
    }

    const nextCrop = clampPhotoCrop(
      photo.size.width,
      photo.size.height,
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

    const element = document.value?.canvasData.elements.find((item) => item.id === id)
    if (
      !element ||
      element.type !== 'photo-placeholder' ||
      element.locked ||
      !(element as PhotoPlaceholder).defaultImageUrl
    ) {
      return
    }

    textEditingElementId.value = null
    photoCropEditingElementId.value = id
    photoDimElementId.value = null
    selectedElementIds.value = [id]
  }

  function stopPhotoCropEditing(): void {
    photoCropEditingElementId.value = null
  }

  function startPhotoDim(id: string): void {
    if (previewMode.value) {
      return
    }

    const element = document.value?.canvasData.elements.find((item) => item.id === id)
    if (
      !element ||
      element.type !== 'photo-placeholder' ||
      element.locked ||
      !(element as PhotoPlaceholder).defaultImageUrl
    ) {
      return
    }

    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    photoDimElementId.value = id
    selectedElementIds.value = [id]
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

    const element = document.value.canvasData.elements.find((item) => item.id === elementId)
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

    const focalLocal = focalPagePoint
      ? pagePointToPhotoLocal(
          photo.size.width,
          photo.size.height,
          photo.position,
          photo.rotation,
          focalPagePoint.x,
          focalPagePoint.y,
        )
      : {
          x: photo.size.width / 2,
          y: photo.size.height / 2,
        }

    const nextCrop = computePhotoCropZoomAtPoint(
      photo.size.width,
      photo.size.height,
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

    const element = document.value.canvasData.elements.find((item) => item.id === id)
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

    const elementsForCheck = elements.value.map((element) => {
      const livePosition = liveDragPositions.value[element.id]

      if (!livePosition) {
        return element
      }

      return {
        ...element,
        position: livePosition,
      }
    })

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

  async function fetchAndLoad(magazineTypeId: string, pageId: string): Promise<void> {
    loading.value = true
    try {
      const page = await adminMagazinePagesApi.getOne(magazineTypeId, pageId)
      loadFromApi(page)
    } finally {
      loading.value = false
    }
  }

  async function saveCanvas(): Promise<void> {
    if (!document.value) {
      return
    }

    flushDebouncedHistory()
    saving.value = true
    try {
      syncCanvasMeta()
      await adminMagazinePagesApi.update(
        document.value.magazineTypeId,
        document.value.magazinePageId,
        { canvasData: document.value.canvasData },
      )
      isDirty.value = false
    } finally {
      saving.value = false
    }
  }

  function reset(): void {
    document.value = null
    selectedElementIds.value = []
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    photoDimElementId.value = null
    photoDropTargetId.value = null
    photoImageDimensions.value = {}
    liveDragPositions.value = {}
    previewMode.value = false
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
    snapToGridEnabled,
    snapGridSize,
    smartGuidesEnabled,
    smartGuideLines,
    printSafeZoneEnabled,
    textEditingElementId,
    photoCropEditingElementId,
    photoDimElementId,
    photoDropTargetId,
    elements,
    layers,
    selectedElement,
    selectedElements,
    alignableSelectedElements,
    isMultiSelection,
    hasSelection,
    selectionCount,
    isElementSelected,
    pageWidth,
    pageHeight,
    backgroundColor,
    templateName,
    isSpreadPage,
    printCropZoneViolation,
    liveDragPositions,
    liveTransformActive,
    canUndo,
    canRedo,
    addElement,
    duplicateElement,
    removeElement,
    removeSelectedElements,
    selectElement,
    toggleElementSelection,
    setSelection,
    clearSelection,
    selectElementsInRect,
    alignSelectedElements,
    applyDistributionGap,
    updateElement,
    recalculateTextElementSize,
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
    startPhotoDim,
    stopPhotoDim,
    zoomPhotoReposition,
    updatePageSettings,
    reorderElements,
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
