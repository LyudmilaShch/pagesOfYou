import { computed, ref, watch, type Ref } from 'vue'

import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { PhotoPlaceholder } from '@/modules/editor/models/photo-placeholder.model'
import type { TextPlaceholder } from '@/modules/editor/models/text-placeholder.model'
import type { ElementPatch } from '@/modules/editor/store/editor.store'
import { isTextPlaceholderType } from '@/modules/editor/utils/normalize-text-placeholder.util'
import {
  recalculateTextLayout,
  shouldRecalculateTextLayout,
} from '@/modules/editor/utils/text-layout.util'
import { getPageCenterPosition } from '@/modules/editor/utils/snap.util'
import { isSpreadCanvas } from '@/modules/editor/utils/spread.util'
import { getPlaceholderPhotoUrl } from '@/modules/editor/utils/placeholder-display.util'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'
import { filesApi } from '../api/orders.api'
import type {
  JournalPage,
  PlaceholderInput,
  PlaceholderJsonValue,
  PlaceholderValue,
} from '../types/order.types'
import {
  mergeElementWithPlaceholderValue,
  type LocalPlaceholderDraft,
} from '../utils/merge-placeholder-element.util'
import {
  getPlaceholderLabel,
  isFillableElement,
  resolvePlaceholderValueType,
} from '../utils/placeholder.utils'

interface OrderFillSessionOptions {
  currentJournalPage: Ref<JournalPage | null>
  isLocalDraft: Ref<boolean>
}

export type OrderElementPatch = Partial<{
  position: Partial<{ x: number; y: number }>
  size: Partial<{ width: number; height: number }>
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontItalic: boolean
  textTransform: 'none' | 'uppercase'
  textAlign: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
  verticalAlign: 'top' | 'middle' | 'bottom'
  color: string
  rotation: number
  fitMode: 'cover' | 'fill'
  borderRadius: number
  cropX: number
  cropY: number
  imageScale: number
  fill: string
  stroke: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed'
  strokePosition: 'center' | 'inside' | 'outside'
}>

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function buildPreviewValue(
  elementId: string,
  valueType: PlaceholderValue['valueType'],
  stored: LocalPlaceholderDraft | undefined,
  existing?: PlaceholderValue,
): PlaceholderValue | null {
  if (!stored) {
    return null
  }

  const hasText = stored.textValue !== undefined
  const hasJson = stored.jsonValue && Object.keys(stored.jsonValue).length > 0

  if (!hasText && !hasJson) {
    return null
  }

  return {
    id: existing?.id ?? `preview-${elementId}`,
    elementId,
    valueType,
    textValue: stored.textValue ?? existing?.textValue ?? null,
    jsonValue: hasJson ? { ...(existing?.jsonValue ?? {}), ...stored.jsonValue } : existing?.jsonValue ?? null,
  }
}

export function useOrderFillSession(options: OrderFillSessionOptions) {
  const { showErrorMessageModal } = useErrorMessageModal()

  const selectedElementId = ref<string | null>(null)
  const textEditingElementId = ref<string | null>(null)
  const photoCropEditingElementId = ref<string | null>(null)
  const uploadingId = ref<string | null>(null)
  const localValues = ref<Record<string, LocalPlaceholderDraft>>({})

  const pageSize = computed(() => {
    if (!options.currentJournalPage.value) {
      return { width: 595, height: 842 }
    }

    const canvas = normalizeCanvasData(options.currentJournalPage.value.pageSnapshot)
    return {
      width: canvas.pageWidth ?? 595,
      height: canvas.pageHeight ?? 842,
    }
  })

  const currentElements = computed(() => {
    if (!options.currentJournalPage.value) {
      return []
    }

    const canvas = normalizeCanvasData(options.currentJournalPage.value.pageSnapshot)
    return flattenTree(canvas.elements)
  })

  const fillableElements = computed(() => currentElements.value.filter(isFillableElement))

  const previewValues = computed((): PlaceholderValue[] => {
    const base = options.currentJournalPage.value?.placeholderValues ?? []
    const map = new Map<string, PlaceholderValue>(
      base.map((value: PlaceholderValue) => [value.elementId, value]),
    )

    for (const element of fillableElements.value) {
      const stored = localValues.value[element.id]
      const preview = buildPreviewValue(
        element.id,
        resolvePlaceholderValueType(element),
        stored,
        map.get(element.id),
      )

      if (preview) {
        map.set(element.id, preview)
      }
    }

    return Array.from(map.values())
  })

  function getSavedValue(elementId: string): PlaceholderValue | undefined {
    return options.currentJournalPage.value?.placeholderValues.find(
      (item) => item.elementId === elementId,
    )
  }

  function getLocalDraft(elementId: string): LocalPlaceholderDraft | undefined {
    return localValues.value[elementId]
  }

  function getMergedElement(elementId: string) {
    const template = currentElements.value.find((element) => element.id === elementId)
    if (!template) {
      return null
    }

    if (isFillableElement(template)) {
      return mergeElementWithPlaceholderValue(
        template,
        getSavedValue(elementId),
        getLocalDraft(elementId),
      )
    }

    return mergeElementWithPlaceholderValue(template, undefined, getLocalDraft(elementId))
  }

  const selectedElement = computed(() => {
    if (!selectedElementId.value) {
      return null
    }

    return getMergedElement(selectedElementId.value)
  })

  const textEditingElement = computed(() => {
    if (!textEditingElementId.value) {
      return null
    }

    const element = getMergedElement(textEditingElementId.value)
    if (!element || element.type === 'photo-placeholder') {
      return null
    }

    return element as TextPlaceholder
  })

  const photoCropEditingElement = computed(() => {
    if (!photoCropEditingElementId.value) {
      return null
    }

    const element = getMergedElement(photoCropEditingElementId.value)
    if (!element || element.type !== 'photo-placeholder') {
      return null
    }

    return element as PhotoPlaceholder
  })

  const isSpreadPage = computed(() => {
    const journalPage = options.currentJournalPage.value
    if (journalPage?.slotType === 'SPREAD') {
      return true
    }

    return isSpreadCanvas(pageSize.value.width, pageSize.value.height)
  })

  function syncLocalValues(): void {
    const next: Record<string, LocalPlaceholderDraft> = {}

    for (const element of fillableElements.value) {
      const value = getSavedValue(element.id)

      if (element.type === 'photo-placeholder') {
        next[element.id] = value?.jsonValue ? { jsonValue: { ...value.jsonValue } } : {}
        continue
      }

      const text = element as TextPlaceholder
      next[element.id] = {
        textValue: value?.textValue ?? text.defaultText ?? text.label ?? '',
        jsonValue: value?.jsonValue ?? undefined,
      }
    }

    localValues.value = next
  }

  function setLocalDraft(elementId: string, draft: LocalPlaceholderDraft): void {
    localValues.value = {
      ...localValues.value,
      [elementId]: {
        ...localValues.value[elementId],
        ...draft,
        jsonValue: {
          ...(localValues.value[elementId]?.jsonValue ?? {}),
          ...(draft.jsonValue ?? {}),
        },
      },
    }
  }

  function patchElement(
    elementId: string,
    patch: OrderElementPatch,
    options?: { skipLayoutRecalc?: boolean },
  ): void {
    const merged = getMergedElement(elementId)
    if (!merged) {
      return
    }

    const json: PlaceholderJsonValue = { ...(localValues.value[elementId]?.jsonValue ?? {}) }

    if (patch.position) {
      json.position = {
        x: patch.position.x ?? merged.position.x,
        y: patch.position.y ?? merged.position.y,
      }
    }

    if (patch.size) {
      json.size = {
        width: patch.size.width ?? merged.size.width,
        height: patch.size.height ?? merged.size.height,
      }
    }

    if ('fontFamily' in patch && patch.fontFamily !== undefined) json.fontFamily = patch.fontFamily
    if ('fontSize' in patch && patch.fontSize !== undefined) json.fontSize = patch.fontSize
    if ('fontWeight' in patch && patch.fontWeight !== undefined) json.fontWeight = patch.fontWeight
    if ('fontItalic' in patch && patch.fontItalic !== undefined) json.fontItalic = patch.fontItalic
    if ('textTransform' in patch && patch.textTransform !== undefined) {
      json.textTransform = patch.textTransform
    }
    if ('textAlign' in patch && patch.textAlign !== undefined) json.textAlign = patch.textAlign
    if ('letterSpacing' in patch && patch.letterSpacing !== undefined) {
      json.letterSpacing = patch.letterSpacing
    }
    if ('lineHeight' in patch && patch.lineHeight !== undefined) json.lineHeight = patch.lineHeight
    if ('verticalAlign' in patch && patch.verticalAlign !== undefined) {
      json.verticalAlign = patch.verticalAlign
    }
    if ('color' in patch && patch.color !== undefined) json.color = patch.color
    if ('rotation' in patch && patch.rotation !== undefined) json.rotation = patch.rotation
    if ('fitMode' in patch && patch.fitMode !== undefined) json.fitMode = patch.fitMode
    if ('borderRadius' in patch && patch.borderRadius !== undefined) {
      json.borderRadius = patch.borderRadius
    }
    if ('cropX' in patch && patch.cropX !== undefined) json.cropX = patch.cropX
    if ('cropY' in patch && patch.cropY !== undefined) json.cropY = patch.cropY
    if ('imageScale' in patch && patch.imageScale !== undefined) {
      json.imageScale = patch.imageScale
    }
    if ('fill' in patch && patch.fill !== undefined) json.fill = patch.fill
    if ('stroke' in patch && patch.stroke !== undefined) json.stroke = patch.stroke
    if ('strokeWidth' in patch && patch.strokeWidth !== undefined) {
      json.strokeWidth = patch.strokeWidth
    }
    if ('strokeStyle' in patch && patch.strokeStyle !== undefined) {
      json.strokeStyle = patch.strokeStyle
    }
    if ('strokePosition' in patch && patch.strokePosition !== undefined) {
      json.strokePosition = patch.strokePosition
    }

    setLocalDraft(elementId, { jsonValue: json })

    if (options?.skipLayoutRecalc) {
      return
    }

    const updatedElement = getMergedElement(elementId)
    if (updatedElement && shouldRecalculateTextLayout(patch as ElementPatch, updatedElement)) {
      recalculateTextElementSize(elementId, undefined, { adjustAnchor: true })
    }
  }

  function recalculateTextElementSize(
    elementId: string,
    displayText?: string | null,
    options?: { adjustAnchor?: boolean },
  ): void {
    const merged = getMergedElement(elementId)
    if (!merged || !isTextPlaceholderType(merged.type)) {
      return
    }

    const layout = recalculateTextLayout({
      element: merged as TextPlaceholder,
      displayText: displayText ?? getTextValue(elementId),
      pageWidth: pageSize.value.width,
      pageHeight: pageSize.value.height,
      adjustAnchor: options?.adjustAnchor ?? false,
    })

    patchElement(
      elementId,
      {
        size: layout.size,
        position: layout.position
          ? {
              x: layout.position.x ?? merged.position.x,
              y: layout.position.y ?? merged.position.y,
            }
          : undefined,
      },
      { skipLayoutRecalc: true },
    )
  }

  function applyDecorativeLayoutDrafts(canvas: CanvasData): CanvasData {
    const normalized = normalizeCanvasData(canvas)

    return {
      ...normalized,
      elements: normalized.elements.map((element) => {
        if (isFillableElement(element)) {
          return element
        }

        const local = getLocalDraft(element.id)
        if (!local?.jsonValue || Object.keys(local.jsonValue).length === 0) {
          return element
        }

        return mergeElementWithPlaceholderValue(element, undefined, local)
      }),
    }
  }

  function getPayload(): PlaceholderInput[] {
    return fillableElements.value.map((element) => {
      const stored = localValues.value[element.id]
      const valueType = resolvePlaceholderValueType(element)
      const saved = getSavedValue(element.id)
      const jsonValue = {
        ...(saved?.jsonValue ?? {}),
        ...(stored?.jsonValue ?? {}),
      }

      if (valueType === 'PHOTO') {
        const hasPhoto = Boolean(jsonValue.url?.trim())
        return {
          elementId: element.id,
          valueType,
          jsonValue: hasPhoto ? jsonValue : {},
        }
      }

      return {
        elementId: element.id,
        valueType,
        textValue: stored?.textValue ?? saved?.textValue ?? '',
        jsonValue: Object.keys(jsonValue).length > 0 ? jsonValue : undefined,
      }
    })
  }

  function getTextValue(elementId: string): string {
    const merged = getMergedElement(elementId)
    if (
      merged &&
      (merged.type === 'text-placeholder' ||
        merged.type === 'title-placeholder' ||
        merged.type === 'subtitle-placeholder')
    ) {
      const saved = getSavedValue(elementId)
      const local = getLocalDraft(elementId)
      if (local?.textValue !== undefined) {
        return local.textValue
      }
      if (saved?.textValue?.trim()) {
        return saved.textValue
      }
      return (merged as TextPlaceholder).defaultText ?? (merged as TextPlaceholder).label ?? ''
    }

    return localValues.value[elementId]?.textValue ?? ''
  }

  function getPhotoUrl(elementId: string): string | undefined {
    return localValues.value[elementId]?.jsonValue?.url ?? getSavedValue(elementId)?.jsonValue?.url
  }

  function selectElement(elementId: string | null): void {
    selectedElementId.value = elementId
  }

  function clearSelection(): void {
    selectedElementId.value = null
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
  }

  function startTextEditing(elementId: string): void {
    photoCropEditingElementId.value = null
    selectedElementId.value = elementId
    textEditingElementId.value = elementId
  }

  function stopTextEditing(): void {
    textEditingElementId.value = null
  }

  function startPhotoCropEditing(elementId: string): void {
    const merged = getMergedElement(elementId)
    if (!merged || merged.type !== 'photo-placeholder') {
      return
    }

    const url = getPlaceholderPhotoUrl(merged, getPhotoUrl(elementId) ?? null)
    if (!url) {
      return
    }

    textEditingElementId.value = null
    selectedElementId.value = elementId
    photoCropEditingElementId.value = elementId
  }

  function stopPhotoCropEditing(): void {
    photoCropEditingElementId.value = null
  }

  function updatePhotoCrop(
    elementId: string,
    patch: Partial<{ cropX: number; cropY: number; imageScale: number }>,
  ): void {
    patchElement(elementId, patch)
  }

  function updateText(elementId: string, value: string | null | undefined): void {
    setLocalDraft(elementId, { textValue: value ?? '' })
    recalculateTextElementSize(elementId, value ?? '', { adjustAnchor: true })
  }

  function clearPhoto(elementId: string): void {
    setLocalDraft(elementId, {
      jsonValue: {
        ...(localValues.value[elementId]?.jsonValue ?? {}),
        url: undefined,
        cropX: 0,
        cropY: 0,
        imageScale: 1,
      },
    })
    if (photoCropEditingElementId.value === elementId) {
      photoCropEditingElementId.value = null
    }
  }

  async function uploadPhoto(elementId: string, file: File): Promise<void> {
    uploadingId.value = elementId

    try {
      const photoUrl = options.isLocalDraft.value
        ? await readFileAsDataUrl(file)
        : (await filesApi.uploadImage(file)).url

      await uploadPhotoFromUrl(elementId, photoUrl)
    } catch (error) {
      showErrorMessageModal(getUploadErrorMessage(error), 'Не удалось загрузить фото')
    } finally {
      uploadingId.value = null
    }
  }

  async function uploadPhotoFromUrl(elementId: string, photoUrl: string): Promise<void> {
    setLocalDraft(elementId, {
      jsonValue: {
        ...(localValues.value[elementId]?.jsonValue ?? {}),
        url: photoUrl,
        cropX: 0,
        cropY: 0,
        imageScale: 1,
      },
    })
    selectedElementId.value = elementId
  }

  function promptPhotoUpload(elementId: string): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) {
        void uploadPhoto(elementId, file)
      }
    }
    input.click()
  }

  function alignSelectedToPageCenter(axis: 'horizontal' | 'vertical' | 'both'): void {
    if (!selectedElementId.value) {
      return
    }

    const merged = getMergedElement(selectedElementId.value)
    if (!merged) {
      return
    }

    const nextPosition = getPageCenterPosition(
      pageSize.value.width,
      pageSize.value.height,
      merged.size.width,
      merged.size.height,
      axis,
      merged.position,
    )

    patchElement(selectedElementId.value, { position: nextPosition })
  }

  function resetSession(): void {
    selectedElementId.value = null
    textEditingElementId.value = null
    photoCropEditingElementId.value = null
    uploadingId.value = null
    localValues.value = {}
  }

  watch(
    () => options.currentJournalPage.value?.id,
    () => {
      resetSession()
      syncLocalValues()
    },
    { immediate: true },
  )

  return {
    selectedElementId,
    textEditingElementId,
    photoCropEditingElementId,
    uploadingId,
    pageSize,
    currentElements,
    fillableElements,
    previewValues,
    selectedElement,
    textEditingElement,
    photoCropEditingElement,
    isSpreadPage,
    syncLocalValues,
    getPayload,
    applyDecorativeLayoutDrafts,
    getTextValue,
    getPhotoUrl,
    getMergedElement,
    selectElement,
    clearSelection,
    startTextEditing,
    stopTextEditing,
    startPhotoCropEditing,
    stopPhotoCropEditing,
    updatePhotoCrop,
    patchElement,
    recalculateTextElementSize,
    alignSelectedToPageCenter,
    updateText,
    clearPhoto,
    uploadPhoto,
    uploadPhotoFromUrl,
    promptPhotoUpload,
    resetSession,
    getPlaceholderLabel,
  }
}

export type OrderFillSession = ReturnType<typeof useOrderFillSession>
