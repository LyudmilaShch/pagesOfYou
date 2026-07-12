import { computed, ref, type Ref } from 'vue'

import { DEFAULT_SNAP_GRID_SIZE } from '@/modules/editor/constants/page.constants'
import type { PageElement } from '@/modules/editor/models'
import type { PhotoPlaceholder } from '@/modules/editor/models/photo-placeholder.model'
import type { ElementPatch } from '@/modules/editor/store/editor.store'
import { hasElementsInPrintCropZone } from '@/modules/editor/utils/print-safe-zone.util'
import {
  clampPhotoCrop,
  computePhotoCropZoomAtPoint,
  getPhotoCropState,
  pagePointToPhotoLocal,
  resolvePhotoRenderFitMode,
} from '@/modules/editor/utils/photo-crop.util'
import { getPhotoRenderBox } from '@/modules/editor/utils/photo-frame.util'
import type { SmartGuideLines } from '@/modules/editor/utils/smart-guides.util'
import { snapCoordinate as snapCoordinateUtil } from '@/modules/editor/utils/snap.util'
import type { OrderFillSession } from '../composables/useOrderFillSession'
import { isFillableElement } from '../utils/placeholder.utils'
import type { OrderCanvasContext } from './order-canvas.types'

function mapElementPatch(patch: ElementPatch): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}

  if (patch.position) mapped.position = patch.position
  if (patch.size) mapped.size = patch.size
  if (patch.fontFamily !== undefined) mapped.fontFamily = patch.fontFamily
  if (patch.fontSize !== undefined) mapped.fontSize = patch.fontSize
  if (patch.fontWeight !== undefined) mapped.fontWeight = patch.fontWeight
  if (patch.fontItalic !== undefined) mapped.fontItalic = patch.fontItalic
  if (patch.textTransform !== undefined) mapped.textTransform = patch.textTransform
  if (patch.textAlign !== undefined) mapped.textAlign = patch.textAlign
  if (patch.letterSpacing !== undefined) mapped.letterSpacing = patch.letterSpacing
  if (patch.lineHeight !== undefined) mapped.lineHeight = patch.lineHeight
  if (patch.verticalAlign !== undefined) mapped.verticalAlign = patch.verticalAlign
  if (patch.color !== undefined) mapped.color = patch.color
  if (patch.fitMode !== undefined) mapped.fitMode = patch.fitMode
  if (patch.borderRadius !== undefined) mapped.borderRadius = patch.borderRadius
  if (patch.cropX !== undefined) mapped.cropX = patch.cropX
  if (patch.cropY !== undefined) mapped.cropY = patch.cropY
  if (patch.imageScale !== undefined) mapped.imageScale = patch.imageScale
  if (patch.rotation !== undefined) mapped.rotation = patch.rotation
  if (patch.fill !== undefined) mapped.fill = patch.fill
  if (patch.stroke !== undefined) mapped.stroke = patch.stroke
  if (patch.strokeWidth !== undefined) mapped.strokeWidth = patch.strokeWidth
  if (patch.strokeStyle !== undefined) mapped.strokeStyle = patch.strokeStyle
  if (patch.strokePosition !== undefined) mapped.strokePosition = patch.strokePosition

  return mapped
}

export function createOrderCanvasContext(
  session: OrderFillSession,
  templateElements: Ref<PageElement[]>,
  backgroundColor: Ref<string>,
): OrderCanvasContext {
  const previewMode = ref(false)
  const canvasZoom = ref(1)
  const snapToGridEnabled = ref(true)
  const snapGridSize = ref(DEFAULT_SNAP_GRID_SIZE)
  const smartGuidesEnabled = ref(true)
  const smartGuideLines = ref<SmartGuideLines>({ vertical: [], horizontal: [], spreadSide: null })
  const printSafeZoneEnabled = ref(false)
  const photoDimElementId = ref<string | null>(null)
  const photoDropTargetId = ref<string | null>(null)
  const liveDragPositions = ref<Record<string, { x: number; y: number }>>({})
  const photoImageDimensions = ref<Record<string, { width: number; height: number }>>({})

  const pageWidth = computed(() => session.pageSize.value.width)
  const pageHeight = computed(() => session.pageSize.value.height)

  const mergedElements = computed(() =>
    templateElements.value.map((element) => {
      const livePosition = liveDragPositions.value[element.id]
      const merged = session.getMergedElement(element.id) ?? element

      if (!livePosition) {
        return merged
      }

      return {
        ...merged,
        position: livePosition,
      }
    }),
  )

  const selectedElementIds = computed(() =>
    session.selectedElementId.value ? [session.selectedElementId.value] : [],
  )

  const selectedElement = computed(() => session.selectedElement.value)

  const alignableSelectedElements = computed(() => {
    if (!selectedElement.value) {
      return []
    }

    const element = selectedElement.value
    if (element.locked || !element.visible) {
      return []
    }

    return [element]
  })

  const isMultiSelection = computed(() => false)

  const isSpreadPage = computed(() => session.isSpreadPage.value)

  const printCropZoneViolation = computed(() => {
    if (previewMode.value) {
      return false
    }

    return hasElementsInPrintCropZone(
      mergedElements.value.filter(isFillableElement),
      pageWidth.value,
      pageHeight.value,
    )
  })

  function isElementSelected(id: string): boolean {
    return session.selectedElementId.value === id
  }

  function selectElement(id: string): void {
    const template = templateElements.value.find((element) => element.id === id)
    if (!template || template.locked || !template.visible) {
      return
    }

    session.selectElement(id)
  }

  function toggleElementSelection(id: string): void {
    selectElement(id)
  }

  function startTextEditing(id: string): void {
    photoDimElementId.value = null
    session.stopPhotoCropEditing()
    session.startTextEditing(id)
  }

  function stopTextEditing(): void {
    session.stopTextEditing()
  }

  function startPhotoDim(id: string): void {
    const merged = session.getMergedElement(id)
    if (!merged || merged.type !== 'photo-placeholder') {
      return
    }

    const photo = merged as PhotoPlaceholder
    if (!photo.defaultImageUrl) {
      return
    }

    session.stopTextEditing()
    session.stopPhotoCropEditing()
    photoDimElementId.value = id
    session.selectElement(id)
  }

  function stopPhotoDim(): void {
    photoDimElementId.value = null
  }

  function startPhotoCropEditing(id: string): void {
    photoDimElementId.value = null
    session.startPhotoCropEditing(id)
  }

  function stopPhotoCropEditing(): void {
    session.stopPhotoCropEditing()
  }

  function setPhotoDropTarget(id: string | null): void {
    photoDropTargetId.value = id
  }

  function setPhotoImage(elementId: string, url: string): void {
    void session.uploadPhotoFromUrl(elementId, url)
  }

  function updatePhotoCrop(
    elementId: string,
    patch: Partial<{ cropX: number; cropY: number; imageScale: number }>,
    _options?: { live?: boolean },
  ): void {
    const merged = session.getMergedElement(elementId)
    if (!merged || merged.type !== 'photo-placeholder') {
      return
    }

    const photo = merged as PhotoPlaceholder
    const dimensions = photoImageDimensions.value[elementId]

    if (!dimensions) {
      session.updatePhotoCrop(elementId, patch)
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

    session.updatePhotoCrop(elementId, nextCrop)
  }

  function resetPhotoCropOnResize(elementId: string, _options?: { live?: boolean }): void {
    session.updatePhotoCrop(elementId, { cropX: 0, cropY: 0, imageScale: 1 })
  }

  function registerPhotoImageDimensions(
    elementId: string,
    size: { width: number; height: number },
  ): void {
    photoImageDimensions.value = {
      ...photoImageDimensions.value,
      [elementId]: size,
    }
  }

  function recalculateTextElementSize(
    id: string,
    displayText?: string | null,
    options?: { adjustAnchor?: boolean },
  ): void {
    session.recalculateTextElementSize(id, displayText, options)
  }

  function updateElement(id: string, patch: ElementPatch, _options?: { live?: boolean }): void {
    if (patch.defaultImageUrl !== undefined) {
      if (patch.defaultImageUrl) {
        setPhotoImage(id, String(patch.defaultImageUrl))
      } else {
        session.clearPhoto(id)
      }
    }

    if (patch.defaultText !== undefined) {
      session.updateText(id, String(patch.defaultText ?? ''))
    }

    const mapped = mapElementPatch(patch)
    if (Object.keys(mapped).length > 0) {
      session.patchElement(id, mapped as Parameters<OrderFillSession['patchElement']>[1], {
        skipLayoutRecalc: patch.defaultText !== undefined,
      })
    }
  }

  function moveElementsPositions(
    patches: Array<{ id: string; position: { x: number; y: number } }>,
  ): void {
    for (const patch of patches) {
      updateElement(patch.id, { position: patch.position })
    }
  }

  function setLiveDragPosition(id: string, position: { x: number; y: number }): void {
    liveDragPositions.value = {
      ...liveDragPositions.value,
      [id]: position,
    }
  }

  function setLiveDragPositions(positions: Record<string, { x: number; y: number }>): void {
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

  function finalizeLiveTransform(): void {
    liveDragPositions.value = {}
  }

  function setSmartGuideLines(lines: SmartGuideLines): void {
    smartGuideLines.value = lines
  }

  function clearSmartGuideLines(): void {
    smartGuideLines.value = { vertical: [], horizontal: [], spreadSide: null }
  }

  function snapCoordinate(value: number): number {
    if (!snapToGridEnabled.value) {
      return value
    }

    return snapCoordinateUtil(value, snapGridSize.value)
  }

  function zoomPhotoReposition(scaleDelta: number, focalPagePoint?: { x: number; y: number }): void {
    const elementId = photoDimElementId.value
    if (!elementId) {
      return
    }

    const merged = session.getMergedElement(elementId)
    if (!merged || merged.type !== 'photo-placeholder') {
      return
    }

    const photo = merged as PhotoPlaceholder
    const dimensions = photoImageDimensions.value[elementId]
    const renderMode = resolvePhotoRenderFitMode(photo.fitMode)

    if (renderMode === 'fill') {
      return
    }

    if (!dimensions) {
      updatePhotoCrop(elementId, { imageScale: photo.imageScale + scaleDelta })
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

  function toggleSnapToGrid(): void {
    snapToGridEnabled.value = !snapToGridEnabled.value
  }

  function toggleSmartGuides(): void {
    smartGuidesEnabled.value = !smartGuidesEnabled.value
  }

  function togglePrintSafeZone(): void {
    printSafeZoneEnabled.value = !printSafeZoneEnabled.value
  }

  function zoomIn(): void {
    canvasZoom.value = Math.min(2, Number((canvasZoom.value + 0.1).toFixed(2)))
  }

  function zoomOut(): void {
    canvasZoom.value = Math.max(0.5, Number((canvasZoom.value - 0.1).toFixed(2)))
  }

  function resetCanvasZoom(): void {
    canvasZoom.value = 1
  }

  function clearSelection(): void {
    photoDimElementId.value = null
    session.clearSelection()
  }

  function getTextValue(elementId: string): string {
    return session.getTextValue(elementId)
  }

  function updateText(elementId: string, value: string): void {
    session.updateText(elementId, value)
  }

  function promptPhotoUpload(elementId: string): void {
    session.promptPhotoUpload(elementId)
  }

  const context: OrderCanvasContext = {
    get previewMode() {
      return previewMode.value
    },
    set previewMode(value: boolean) {
      previewMode.value = value
    },
    get canvasZoom() {
      return canvasZoom.value
    },
    set canvasZoom(value: number) {
      canvasZoom.value = value
    },
    get snapToGridEnabled() {
      return snapToGridEnabled.value
    },
    set snapToGridEnabled(value: boolean) {
      snapToGridEnabled.value = value
    },
    get snapGridSize() {
      return snapGridSize.value
    },
    set snapGridSize(value: number) {
      snapGridSize.value = value
    },
    get smartGuidesEnabled() {
      return smartGuidesEnabled.value
    },
    set smartGuidesEnabled(value: boolean) {
      smartGuidesEnabled.value = value
    },
    get smartGuideLines() {
      return smartGuideLines.value
    },
    set smartGuideLines(value: SmartGuideLines) {
      smartGuideLines.value = value
    },
    get printSafeZoneEnabled() {
      return printSafeZoneEnabled.value
    },
    set printSafeZoneEnabled(value: boolean) {
      printSafeZoneEnabled.value = value
    },
    get printCropZoneViolation() {
      return printCropZoneViolation.value
    },
    get textEditingElementId() {
      return session.textEditingElementId.value
    },
    get photoCropEditingElementId() {
      return session.photoCropEditingElementId.value
    },
    get photoDimElementId() {
      return photoDimElementId.value
    },
    set photoDimElementId(value: string | null) {
      photoDimElementId.value = value
    },
    get photoDropTargetId() {
      return photoDropTargetId.value
    },
    set photoDropTargetId(value: string | null) {
      photoDropTargetId.value = value
    },
    get liveDragPositions() {
      return liveDragPositions.value
    },
    set liveDragPositions(value: Record<string, { x: number; y: number }>) {
      liveDragPositions.value = value
    },
    get pageWidth() {
      return pageWidth.value
    },
    get pageHeight() {
      return pageHeight.value
    },
    get backgroundColor() {
      return backgroundColor.value
    },
    get elements() {
      return mergedElements.value
    },
    get selectedElementIds() {
      return selectedElementIds.value
    },
    get selectedElement() {
      return selectedElement.value
    },
    get alignableSelectedElements() {
      return alignableSelectedElements.value
    },
    get isMultiSelection() {
      return isMultiSelection.value
    },
    get isSpreadPage() {
      return isSpreadPage.value
    },
    isElementSelected,
    selectElement,
    toggleElementSelection,
    startTextEditing,
    stopTextEditing,
    startPhotoDim,
    stopPhotoDim,
    startPhotoCropEditing,
    stopPhotoCropEditing,
    setPhotoDropTarget,
    setPhotoImage,
    updatePhotoCrop,
    resetPhotoCropOnResize,
    registerPhotoImageDimensions,
    updateElement,
    recalculateTextElementSize,
    moveElementsPositions,
    setLiveDragPosition,
    setLiveDragPositions,
    clearLiveDragPosition,
    clearLiveDragPositions,
    finalizeLiveTransform,
    setSmartGuideLines,
    clearSmartGuideLines,
    snapCoordinate,
    zoomPhotoReposition,
    toggleSnapToGrid,
    toggleSmartGuides,
    togglePrintSafeZone,
    zoomIn,
    zoomOut,
    resetCanvasZoom,
    clearSelection,
    getTextValue,
    updateText,
    promptPhotoUpload,
  }

  return context
}
