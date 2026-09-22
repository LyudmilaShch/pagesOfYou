<template>
  <div ref="containerRef" class="spread-thumb" :style="rootStyle">
    <div class="spread-thumb__page" :style="pageStyle">
      <!-- Per-page backgrounds (spreadBackgroundMode: 'per-page') need two independently-clipped
           layers, one per side — a single full-bleed image (the old approach here) always painted
           whichever side actually had a background across BOTH pages. getSpreadBackgroundRenderLayers
           is the same pure geometry the Konva admin canvas already renders through (see
           PageBackgroundLayer.vue/SpreadPageBackgroundLayers.vue), so this now matches it exactly. -->
      <div
        v-for="layer in backgroundLayers"
        :key="layer.key"
        class="spread-thumb__bg-layer"
        :style="backgroundLayerStyle(layer)"
      >
        <img
          v-if="layer.settings.backgroundImageUrl"
          class="spread-thumb__bg"
          :style="backgroundImageStyle(layer)"
          :src="resolveAssetUrl(layer.settings.backgroundImageUrl) ?? layer.settings.backgroundImageUrl"
          alt=""
        />
      </div>

      <div
        v-for="leaf in leaves"
        :key="leaf.id"
        class="spread-thumb__el"
        :class="{
          'spread-thumb__el--actionable': isActionableLeaf(leaf),
          'spread-thumb__el--active': activeElementId === leaf.id,
        }"
        :data-element-id="leaf.id"
        :style="elementStyle(leaf)"
        @click="handleElementTap(leaf)"
      >
        <template v-if="isPhotoElement(leaf) && leaf.defaultImageUrl">
          <img
            class="spread-thumb__photo"
            :class="{
              'spread-thumb__photo--droppable': dropEnabled,
              'spread-thumb__photo--drag-over': dropEnabled && dragOverElementId === leaf.id,
            }"
            :data-element-id="leaf.id"
            :src="resolveAssetUrl(leaf.defaultImageUrl) ?? leaf.defaultImageUrl"
            :style="photoImageStyle(leaf)"
            alt=""
            @dragover.prevent="onDragOver(leaf.id)"
            @dragleave="onDragLeave(leaf.id)"
            @drop.prevent="onDrop($event, leaf.id)"
          />
          <div v-if="cropEnabled || pickEnabled" class="spread-thumb__photo-actions" :style="actionsCenterStyle(leaf)">
            <v-tooltip v-if="pickEnabled" location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  type="button"
                  class="spread-thumb__photo-action-btn"
                  aria-label="Заменить фото"
                  @click.stop="emit('pick-photo', leaf.id)"
                >
                  <v-icon size="14" color="black">mdi-image-refresh-outline</v-icon>
                </button>
              </template>
              Заменить фото
            </v-tooltip>
            <v-tooltip v-if="cropEnabled" location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  type="button"
                  class="spread-thumb__photo-action-btn"
                  aria-label="Кадрировать фото"
                  @click.stop="emit('crop-photo', leaf.id)"
                >
                  <v-icon size="14" color="black">mdi-crop</v-icon>
                </button>
              </template>
              Кадрировать фото
            </v-tooltip>
          </div>
        </template>
        <div
          v-else-if="isPhotoElement(leaf)"
          class="spread-thumb__photo-empty"
          :class="{
            'spread-thumb__photo-empty--droppable': dropEnabled,
            'spread-thumb__photo-empty--drag-over': dropEnabled && dragOverElementId === leaf.id,
          }"
          :data-element-id="leaf.id"
          @dragover.prevent="onDragOver(leaf.id)"
          @dragleave="onDragLeave(leaf.id)"
          @drop.prevent="onDrop($event, leaf.id)"
        >
          <v-tooltip v-if="pickEnabled" location="top" content-class="editor-tooltip--arrow-top">
            <template #activator="{ props: tooltipProps }">
              <button
                v-bind="tooltipProps"
                type="button"
                class="spread-thumb__pick-btn"
                :style="actionsCenterStyle(leaf)"
                aria-label="Выбрать фото"
                @click.stop="emit('pick-photo', leaf.id)"
              >
                <v-icon size="18" color="black">mdi-image-plus</v-icon>
              </button>
            </template>
            Выбрать фото
          </v-tooltip>
        </div>

        <div v-else-if="isTextElement(leaf)" class="spread-thumb__text" :style="textStyle(leaf)">
          {{ leaf.defaultText }}
        </div>

        <div
          v-else-if="isAiTextElement(leaf) && pendingElementIds.has(leaf.id)"
          class="spread-thumb__text-shimmer"
        >
          <p class="spread-thumb__text-shimmer-label" :style="shimmerLabelStyle(leaf)">
            Генерируем текст
            <span class="spread-thumb__text-shimmer-dots" aria-hidden="true">
              <span class="spread-thumb__text-shimmer-dot" />
              <span class="spread-thumb__text-shimmer-dot" />
              <span class="spread-thumb__text-shimmer-dot" />
            </span>
          </p>
          <div class="spread-thumb__text-shimmer-lines">
            <span v-for="n in 3" :key="n" class="spread-thumb__text-shimmer-line" />
          </div>
        </div>
        <template v-else-if="isAiTextElement(leaf)">
          <div class="spread-thumb__text" :style="textStyle(leaf)">
            {{ leaf.previewPlaceholderText }}
          </div>
          <div v-if="aiTextEditEnabled" class="spread-thumb__photo-actions">
            <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  type="button"
                  class="spread-thumb__photo-action-btn"
                  aria-label="Изменить текст"
                  @click.stop="emit('edit-ai-text', leaf.id)"
                >
                  <v-icon size="14" color="black">mdi-pencil-outline</v-icon>
                </button>
              </template>
              Изменить текст
            </v-tooltip>
            <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  type="button"
                  class="spread-thumb__photo-action-btn"
                  aria-label="Сгенерировать другой вариант"
                  @click.stop="emit('regenerate-ai-text', leaf.id)"
                >
                  <v-icon size="14" color="black">mdi-refresh</v-icon>
                </button>
              </template>
              Сгенерировать другой вариант
            </v-tooltip>
          </div>
        </template>

        <div v-else-if="isTocElement(leaf)" class="spread-thumb__toc" :style="tocContainerStyle(leaf)">
          <div
            v-for="entry in resolveTocEntries(leaf)"
            :key="entry.pageId"
            class="spread-thumb__toc-entry"
            :style="tocEntryStyle(leaf)"
          >
            <span class="spread-thumb__toc-title">{{ entry.title }}</span>
            <span v-if="leaf.dotLeader" class="spread-thumb__toc-leader" aria-hidden="true" />
            <span class="spread-thumb__toc-number">{{ entry.pageLabel }}</span>
          </div>
        </div>

        <div v-else-if="isShapeElement(leaf)" class="spread-thumb__shape" :style="shapeStyle(leaf)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type {
  AiTextPlaceholder,
  CanvasData,
  LeafElement,
  PhotoPlaceholder,
  ShapeElement,
  TextPlaceholder,
  TocEntry,
  TocPlaceholder,
} from '../models'
import { isAiTextElement, isPhotoElement, isShapeElement, isTextElement, isTocElement } from '../models'
import { flattenTree } from '../utils/element-tree.util'
import { ensureCustomFontsLoaded } from '../utils/custom-fonts.util'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '../constants/page.constants'
import { computePhotoImageLayout, getPhotoCropState, resolvePhotoRenderFitMode } from '../utils/photo-crop.util'
import {
  getSpreadBackgroundRenderLayers,
  type SpreadBackgroundRenderLayer,
} from '../utils/spread-background.util'
import { resolveAssetUrl } from '@/shared/config/assets'

const props = withDefaults(
  defineProps<{
    canvasData: CanvasData
    /** When set, this component sizes its OWN height from its measured width (`width / containerRatio`,
     * via JS) instead of expecting a parent-supplied `height: 100%` box. Needed inside a CSS Grid cell
     * whose column comes from `auto-fill`/`minmax(_, 1fr)`: `aspect-ratio`/`padding-bottom` (both
     * width-dependent-height CSS techniques) size incorrectly there — Grid's implicit `auto` row-track
     * measurement can under-measure them, clipping or overlapping neighbouring cards. A definite,
     * already-resolved pixel height set via JS has no such ambiguity for Grid to get wrong. */
    containerRatio?: number
    /** ai-text-placeholder element ids whose generation is currently in flight (a save request that
     * touches one of their feeding questions hasn't resolved yet — see QuestionnairePage.vue's
     * `pendingAiElementIds`) — shown as a shimmer instead of the (possibly stale) preview text. */
    pendingElementIds?: Set<string>
    /** Manual photo-placement mode (see PhotoUploadPage.vue) — every photo-placeholder becomes a
     * drop target, highlighted while a drag is over it, emitting `drop-photo` on release instead
     * of doing anything itself (this component has no store access — the parent owns the save). */
    dropEnabled?: boolean
    /** Shows a small crop button on every filled photo element, emitting `crop-photo` on click
     * instead of doing anything itself — same "no store access" split as `dropEnabled` above. */
    cropEnabled?: boolean
    /** Shows an "add photo" button on every empty photo slot, emitting `pick-photo` on click —
     * same split as `dropEnabled`/`cropEnabled` above. A click-driven alternative to dragging: the
     * parent opens a gallery picker for that specific slot (see PhotoUploadPage.vue). */
    pickEnabled?: boolean
    /** Shows "edit text"/"regenerate" buttons on every settled (non-pending) ai-text-placeholder,
     * emitting `edit-ai-text`/`regenerate-ai-text` on click — same split as the photo-action props
     * above. Only QuestionnairePage.vue's book offers this (see order-builder.store.ts's
     * `regenerateAiText`, which needs a real backend order). */
    aiTextEditEnabled?: boolean
    /** Real rows for every toc-placeholder on this page — computed once by the caller from the
     * order's/template's actual page list (see journal-structure.util.ts's `buildTocEntries`),
     * since this component only ever sees ITS OWN page's canvasData, never its siblings. Left
     * unset in contexts with no such list to draw from (template pickers, admin thumbnails),
     * where a generic preview shows instead — see `resolveTocEntries`. */
    tocEntries?: TocEntry[]
    /** Set by QuestionnaireBook.vue when this instance is windowed into one half of a page-flip
     * leaf — a SPREAD/TOC canvas renders at full (both-page) width here, clipped by the parent to
     * just this half (see its own `windowFor`). Action buttons default to centering on an
     * element's own middle, which for an element spanning both halves (e.g. a full-bleed photo)
     * sits exactly on the spine — clipped almost entirely out of view in either half. When set,
     * `photoActionsStyle`/`pickBtnStyle` clamp that center to the visible half instead. Left unset
     * (every other caller — admin previews, the manual-placement grid, etc.) for the original,
     * unclamped centering, since those render the canvas at its own natural, unwindowed width. */
    visibleHalf?: 'left' | 'right'
  }>(),
  {
    pendingElementIds: () => new Set(),
    dropEnabled: false,
    cropEnabled: false,
    pickEnabled: false,
    aiTextEditEnabled: false,
  },
)

const emit = defineEmits<{
  'drop-photo': [elementId: string, url: string]
  'crop-photo': [elementId: string]
  'pick-photo': [elementId: string]
  'edit-ai-text': [elementId: string]
  'regenerate-ai-text': [elementId: string]
}>()

const dragOverElementId = ref<string | null>(null)

function isActionableLeaf(leaf: LeafElement): boolean {
  return (
    ((props.cropEnabled || props.pickEnabled) && isPhotoElement(leaf) && !!leaf.defaultImageUrl) ||
    (props.aiTextEditEnabled && isAiTextElement(leaf) && !props.pendingElementIds.has(leaf.id))
  )
}

// On a device with real hover, the crop/replace/edit-text/regenerate buttons reveal on
// :hover (see the `@media (hover: hover)` CSS below) and this stays unused. On touch, there's no
// hover to reveal them with — showing them permanently would clutter the small mobile spread
// card, so a tap on the element toggles them instead (a second tap on the same element hides them
// again; tapping a different one switches to it).
const activeElementId = ref<string | null>(null)

function handleElementTap(leaf: LeafElement): void {
  if (!isActionableLeaf(leaf)) {
    return
  }
  activeElementId.value = activeElementId.value === leaf.id ? null : leaf.id
}

// Closes the tap-revealed actions when the user clicks/taps anywhere outside the active element —
// e.g. elsewhere in the book, or outside it entirely. Runs on the document because it needs to see
// clicks the local @click handlers above don't cover (a different, non-actionable element; outside
// this component altogether). A click on the active element itself (including its own now-visible
// action buttons, which stop propagation) never reaches here with a mismatching id, so it's left
// open; handleElementTap above already updates `activeElementId` before this runs for the same
// click, so switching straight to a different actionable element doesn't get closed either.
function handleDocumentClick(event: MouseEvent): void {
  if (activeElementId.value === null) {
    return
  }
  const target = event.target as HTMLElement | null
  const leafEl = target?.closest('.spread-thumb__el') as HTMLElement | null
  if (leafEl?.dataset.elementId !== activeElementId.value) {
    activeElementId.value = null
  }
}

function onDragOver(elementId: string): void {
  if (props.dropEnabled) {
    dragOverElementId.value = elementId
  }
}

function onDragLeave(elementId: string): void {
  if (dragOverElementId.value === elementId) {
    dragOverElementId.value = null
  }
}

function onDrop(event: DragEvent, elementId: string): void {
  dragOverElementId.value = null
  if (!props.dropEnabled) {
    return
  }
  const url = event.dataTransfer?.getData('text/plain')
  if (url) {
    emit('drop-photo', elementId, url)
  }
}

const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)
const selfHeight = ref(0)

const rootStyle = computed(() =>
  props.containerRatio ? { height: `${selfHeight.value}px` } : undefined,
)

const pageWidth = computed(() => props.canvasData.pageWidth ?? A4_PAGE_WIDTH)
const pageHeight = computed(() => props.canvasData.pageHeight ?? A4_PAGE_HEIGHT)

/** The container keeps whatever box shape the parent gives it (a uniform grid cell, regardless of
 * whether this page is a tall cover or a wide spread); the page itself is fit inside it letterboxed
 * (like `object-fit: contain`) instead of stretching the container to the page's own aspect ratio —
 * otherwise covers/back covers (portrait) tower over spreads (landscape) in the same grid. */
const pageStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${offsetX.value}px`,
  top: `${offsetY.value}px`,
  width: `${pageWidth.value * scale.value}px`,
  height: `${pageHeight.value * scale.value}px`,
  // Own background color moved to each background layer (see `backgroundLayers`) so per-page
  // mode can paint the left/right halves differently — this is just a neutral base in case a
  // layer's own color is somehow transparent, not the real background anymore.
  backgroundColor: '#FFFFFF',
  overflow: 'hidden' as const,
}))

// Pure geometry, no Konva dependency — the exact same layer split the admin canvas renders
// through (PageBackgroundLayer.vue/SpreadPageBackgroundLayers.vue), reused here so this component
// matches it instead of only ever painting the flat root background across the whole page.
const backgroundLayers = computed(() => getSpreadBackgroundRenderLayers(props.canvasData))

function backgroundLayerStyle(layer: SpreadBackgroundRenderLayer): Record<string, string> {
  return {
    position: 'absolute',
    left: `${layer.x * scale.value}px`,
    top: '0px',
    width: `${layer.width * scale.value}px`,
    height: `${pageHeight.value * scale.value}px`,
    overflow: 'hidden',
    backgroundColor: layer.settings.backgroundColor,
  }
}

/** Same natural-size-then-computePhotoImageLayout approach as `photoImageStyle` below — a
 * background image shares the exact same fit/crop shape (cover|fill, cropX/cropY, imageScale) as
 * a photo element, just scoped to a background layer's own box instead of an element's. */
function backgroundImageStyle(layer: SpreadBackgroundRenderLayer): Record<string, string> {
  const rawUrl = layer.settings.backgroundImageUrl
  const fallback = { width: '100%', height: '100%', objectFit: 'cover' }
  if (!rawUrl) {
    return fallback
  }

  const url = resolveAssetUrl(rawUrl) ?? rawUrl
  void imageSizeTick.value
  const natural = imageNaturalSizes.get(url)
  if (!natural || natural.width <= 0 || natural.height <= 0) {
    ensureImageNaturalSize(url)
    return fallback
  }

  const layout = computePhotoImageLayout(
    layer.width,
    pageHeight.value,
    natural.width,
    natural.height,
    layer.settings.backgroundImageFit,
    { cropX: layer.settings.backgroundImageCropX, cropY: layer.settings.backgroundImageCropY, imageScale: layer.settings.backgroundImageScale },
  )
  if (!layout) {
    return fallback
  }

  return {
    position: 'absolute',
    left: `${layout.x * scale.value}px`,
    top: `${layout.y * scale.value}px`,
    width: `${layout.width * scale.value}px`,
    height: `${layout.height * scale.value}px`,
    maxWidth: 'none',
  }
}

/** `flattenTree` already resolves group nesting into absolute page coordinates, so nested groups
 * need no special handling here — every leaf's `position`/`rotation` is already page-relative. */
const leaves = computed<LeafElement[]>(() =>
  flattenTree(props.canvasData.elements).filter((leaf) => leaf.visible !== false),
)

let observer: ResizeObserver | null = null

function updateScale(): void {
  if (!containerRef.value) {
    return
  }

  const containerWidth = containerRef.value.clientWidth
  // Derived from the just-measured width, not read back via `clientHeight` — when
  // `containerRatio` is set, the root's own height is itself driven by this same value (see
  // `rootStyle`), and reading `clientHeight` here could race the DOM update from that.
  const containerHeight = props.containerRatio
    ? containerWidth / props.containerRatio
    : containerRef.value.clientHeight

  if (props.containerRatio) {
    selfHeight.value = containerHeight
  }

  const fit = Math.min(containerWidth / pageWidth.value, containerHeight / pageHeight.value)

  scale.value = fit
  offsetX.value = (containerWidth - pageWidth.value * fit) / 2
  offsetY.value = (containerHeight - pageHeight.value * fit) / 2
}

onMounted(() => {
  updateScale()
  observer = new ResizeObserver(() => updateScale())
  if (containerRef.value) {
    observer.observe(containerRef.value)
  }
  // Only the advanced per-element editor pages called this before — this component also renders
  // text outside any of them now (the questionnaire/photo-upload book preview), so a custom admin
  // font referenced by `textStyle()`'s `fontFamily` would otherwise never actually get registered
  // via the FontFace API there, silently falling back to the browser default. Safe to call
  // redundantly — later callers reuse the same in-flight/resolved promise.
  void ensureCustomFontsLoaded()

  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('click', handleDocumentClick)
})

// Per-instance natural-size cache (not module-level — a handful of photos rendered at once, HTTP
// cache already dedupes the actual bytes across instances showing the same URL, so the modest
// redundant decode cost isn't worth a cross-instance singleton). Keyed by URL so a photo reused on
// several elements only loads once per instance. `imageSizeTick` exists purely to give
// `photoImageStyle` a reactive dependency to re-run against once a size resolves — the cache/pending
// set themselves are plain (non-reactive) since only their *presence*, not their content, needs to
// trigger a re-render.
const imageNaturalSizes = new Map<string, { width: number; height: number }>()
const pendingImageSizeUrls = new Set<string>()
const imageSizeTick = ref(0)

function ensureImageNaturalSize(url: string): void {
  if (imageNaturalSizes.has(url) || pendingImageSizeUrls.has(url)) {
    return
  }
  pendingImageSizeUrls.add(url)
  const img = new Image()
  img.onload = () => {
    imageNaturalSizes.set(url, { width: img.naturalWidth, height: img.naturalHeight })
    pendingImageSizeUrls.delete(url)
    imageSizeTick.value += 1
  }
  img.onerror = () => {
    pendingImageSizeUrls.delete(url)
  }
  img.src = url
}

/** Absolute-positions the `<img>` per `computePhotoImageLayout` so a non-default crop
 * (cropX/cropY/imageScale, set via PhotoCropModal.vue) actually shows — plain `object-fit: cover`
 * (the CSS fallback below, used until the natural size resolves) can only ever render the
 * centered, unzoomed crop. Coordinates from the util come back in the SAME unscaled page-point
 * space as `leaf.size`/`leaf.position` (matching the real Konva adapter's own convention), so the
 * result is scaled by `scale.value` here exactly like `elementStyle` does for the wrapping box. */
function photoImageStyle(leaf: PhotoPlaceholder): Record<string, string> {
  const rawUrl = leaf.defaultImageUrl
  const fallback = { width: '100%', height: '100%', objectFit: 'cover', borderRadius: `${(leaf.borderRadius ?? 0) * scale.value}px` }
  if (!rawUrl) {
    return fallback
  }
  const url = resolveAssetUrl(rawUrl) ?? rawUrl

  void imageSizeTick.value
  const natural = imageNaturalSizes.get(url)
  if (!natural || natural.width <= 0 || natural.height <= 0) {
    ensureImageNaturalSize(url)
    return fallback
  }

  const layout = computePhotoImageLayout(
    leaf.size.width,
    leaf.size.height,
    natural.width,
    natural.height,
    resolvePhotoRenderFitMode(leaf.fitMode),
    getPhotoCropState(leaf),
  )
  if (!layout) {
    return fallback
  }

  return {
    position: 'absolute',
    left: `${layout.x * scale.value}px`,
    top: `${layout.y * scale.value}px`,
    width: `${layout.width * scale.value}px`,
    height: `${layout.height * scale.value}px`,
    maxWidth: 'none',
    borderRadius: `${(leaf.borderRadius ?? 0) * scale.value}px`,
  }
}

/** Centers the crop/replace/pick button on a photo element's own middle — same as the CSS default
 * (`top:50%;left:50%;transform:translate(-50%,-50%)` on `.spread-thumb__photo-actions`/
 * `.spread-thumb__pick-btn`) EXCEPT when `visibleHalf` is set (see its own doc comment): a photo
 * spanning both halves of a windowed spread (a common "full-bleed" layout) has its own middle sit
 * exactly on the spine, which the parent window clips almost entirely away in either half — the
 * button ends up unreachable, not just off-center. Clamping the horizontal center to the visible
 * half's own bounds (intersected with the element's own bounds, so a button never drifts outside
 * an element far smaller than half the spread) keeps it inside whichever half is actually shown.
 * Returns undefined when unwindowed, leaving the CSS default in place unchanged. */
function actionsCenterStyle(leaf: PhotoPlaceholder): Record<string, string> | undefined {
  if (!props.visibleHalf) {
    return undefined
  }

  const elLeft = leaf.position.x * scale.value
  const elRight = elLeft + leaf.size.width * scale.value
  const halfWidthPx = (pageWidth.value / 2) * scale.value
  const visibleLeft = props.visibleHalf === 'left' ? 0 : halfWidthPx
  const visibleRight = props.visibleHalf === 'left' ? halfWidthPx : halfWidthPx * 2

  const clampedLeft = Math.max(elLeft, visibleLeft)
  const clampedRight = Math.min(elRight, visibleRight)
  const centerX = (clampedLeft + clampedRight) / 2 - elLeft

  return {
    position: 'absolute',
    left: `${centerX}px`,
    top: '50%',
    transform: 'translate(-50%, -50%)',
  }
}

/** Same color the real generated text will render in (`leaf.color`) — not a fixed neutral tone —
 * so the "Генерируем текст" label reads as a preview of what's coming, not a generic system
 * notice. Font size scales with the page the same way `textStyle` does for real text. */
function shimmerLabelStyle(leaf: AiTextPlaceholder): Record<string, string> {
  return {
    color: leaf.color,
    fontSize: `${Math.max(8, 9 * scale.value)}px`,
  }
}

function elementStyle(leaf: LeafElement): Record<string, string> {
  // A shape-line's own `size.height` is always 0 — like the Konva canvas (see
  // getShapeLineConfig/element-node.adapter.ts, which draws points [0,0]→[width,0]), it's a
  // zero-height path whose visible thickness comes entirely from `strokeWidth`, drawn centred on
  // that path. Giving the wrapper a literal 0px height here (as a straight `size.height * scale`
  // read would) makes `overflow: hidden` clip away anything drawn inside it — the line just never
  // appears — so it needs its own box sized to the stroke instead, recentred on the same position.
  if (leaf.type === 'shape-line') {
    const lineHeight = Math.max(leaf.strokeWidth, 1) * scale.value
    return {
      position: 'absolute',
      left: `${leaf.position.x * scale.value}px`,
      top: `${leaf.position.y * scale.value - lineHeight / 2}px`,
      width: `${leaf.size.width * scale.value}px`,
      height: `${lineHeight}px`,
      transform: leaf.rotation ? `rotate(${leaf.rotation}deg)` : '',
      opacity: String(leaf.opacity ?? 1),
      overflow: 'hidden',
    }
  }

  return {
    position: 'absolute',
    left: `${leaf.position.x * scale.value}px`,
    top: `${leaf.position.y * scale.value}px`,
    width: `${leaf.size.width * scale.value}px`,
    height: `${leaf.size.height * scale.value}px`,
    transform: leaf.rotation ? `rotate(${leaf.rotation}deg)` : '',
    opacity: String(leaf.opacity ?? 1),
    // Text boxes are sized to fit their content with almost no slack (TEXT_BOX_PADDING is 0 — see
    // text-auto-size.util.ts, which sizes the box from Konva's own text measurement plus a bare
    // 2px buffer). The browser's native text layout doesn't measure identically to Konva's
    // (different metrics entirely, more so now that the real font actually loads — see
    // `textStyle`'s fontFamily), so a glyph can end up a pixel or two taller/wider than the box.
    // Clipping that with overflow:hidden cuts letters/digits off; better to let it spill slightly.
    overflow: isTextElement(leaf) || isAiTextElement(leaf) ? 'visible' : 'hidden',
  }
}

function textStyle(leaf: TextPlaceholder | AiTextPlaceholder): Record<string, string> {
  return {
    display: 'flex',
    alignItems: leaf.verticalAlign === 'top' ? 'flex-start' : leaf.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: leaf.textAlign === 'left' ? 'flex-start' : leaf.textAlign === 'right' ? 'flex-end' : 'center',
    fontFamily: leaf.fontFamily,
    fontSize: `${leaf.fontSize * scale.value}px`,
    fontWeight: String(leaf.fontWeight ?? 400),
    fontStyle: leaf.fontItalic ? 'italic' : 'normal',
    color: leaf.color,
    textAlign: leaf.textAlign,
    textTransform: leaf.textTransform === 'uppercase' ? 'uppercase' : 'none',
    lineHeight: String(leaf.lineHeight ?? 1.2),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    // Several fonts in the picker (Playfair Display notably) default to old-style figures —
    // digits with varying height/depth like lowercase letters, sitting off the baseline — instead
    // of the aligned "lining" figures the Konva canvas itself renders with no special feature
    // config. Without this, digits only started looking vertically offset once `fontFamily` above
    // began actually applying the real font; forcing lining figures here matches the canvas.
    fontVariantNumeric: 'lining-nums',
  }
}

// Shown whenever no real order/template data was supplied (see the `tocEntries` prop) — mirrors
// element-node.adapter.ts's own Konva-side preview rows, so the admin sees roughly the same thing
// switching between the canvas and any thumbnail that renders through this component instead.
const TOC_PREVIEW_ENTRIES: TocEntry[] = [
  { pageId: '__toc-preview-1', title: 'Пример раздела 1', pageLabel: '3' },
  { pageId: '__toc-preview-2', title: 'Пример раздела 2', pageLabel: '5' },
  { pageId: '__toc-preview-3', title: 'Пример раздела 3', pageLabel: '7' },
]

function resolveTocEntries(leaf: TocPlaceholder): TocEntry[] {
  void leaf
  return props.tocEntries ?? TOC_PREVIEW_ENTRIES
}

// Shrinks the gap between entries (never below 0, never above the admin's own configured value)
// just enough that every row's single-line height still fits the element's box — estimated from
// font metrics rather than measuring real DOM height, so it stays a synchronous, side-effect-free
// style computation like every other leaf here. A long title that WRAPS to two lines is the one
// case this doesn't account for — a rarer, harder-to-solve-cheaply case than the common "a
// customer added a lot of spreads" one this is actually for.
function tocEntryGap(leaf: TocPlaceholder): number {
  const entryCount = resolveTocEntries(leaf).length
  const gapCount = entryCount - 1
  if (gapCount <= 0) {
    return leaf.entryGap
  }

  const rowHeight = leaf.fontSize * (leaf.lineHeight || 1.2)
  const availableForGaps = leaf.size.height - entryCount * rowHeight
  const idealGap = availableForGaps / gapCount

  return Math.max(0, Math.min(leaf.entryGap, idealGap))
}

function tocContainerStyle(leaf: TocPlaceholder): Record<string, string> {
  return {
    display: 'flex',
    flexDirection: 'column',
    // Anchors the whole block within the element's box — same meaning as a text element's own
    // "Закрепить поле" (top/middle/bottom), just applied to the list as a unit rather than a
    // single text flow.
    justifyContent:
      leaf.verticalAlign === 'bottom' ? 'flex-end' : leaf.verticalAlign === 'middle' ? 'center' : 'flex-start',
    gap: `${tocEntryGap(leaf) * scale.value}px`,
    fontFamily: leaf.fontFamily,
    fontSize: `${leaf.fontSize * scale.value}px`,
    fontWeight: String(leaf.fontWeight ?? 400),
    fontStyle: leaf.fontItalic ? 'italic' : 'normal',
    color: leaf.color,
    textTransform: leaf.textTransform === 'uppercase' ? 'uppercase' : 'none',
    lineHeight: String(leaf.lineHeight ?? 1.2),
    letterSpacing: `${leaf.letterSpacing * scale.value}px`,
    overflow: 'hidden',
    fontVariantNumeric: 'lining-nums',
  }
}

// With a dot leader, the classic layout (title flush left, number flush right, dots filling the
// gap) always wins — `textAlign` has nothing meaningful to add there. Without one, the title and
// number sit together as a single unit that `textAlign` positions within the row.
function tocEntryStyle(leaf: TocPlaceholder): Record<string, string> {
  if (leaf.dotLeader) {
    return { display: 'flex', alignItems: 'baseline', gap: `${4 * scale.value}px` }
  }

  return {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent:
      leaf.textAlign === 'right' ? 'flex-end' : leaf.textAlign === 'center' ? 'center' : 'flex-start',
    gap: `${8 * scale.value}px`,
  }
}

function shapeStyle(leaf: ShapeElement): Record<string, string> {
  // A line has no fill (transparent by design — see create-element.factory.ts) and its wrapper is
  // already sized to exactly the stroke thickness (see `elementStyle`), so it's just a solid bar
  // matching `stroke` — the border-based approach below would double it (border on all 4 sides of
  // an already-stroke-sized box).
  if (leaf.type === 'shape-line') {
    return { width: '100%', height: '100%', background: leaf.stroke }
  }

  return {
    width: '100%',
    height: '100%',
    background: leaf.fill,
    border: leaf.strokeWidth ? `${leaf.strokeWidth * scale.value}px solid ${leaf.stroke}` : '',
    borderRadius: leaf.type === 'shape-circle' ? '50%' : `${(leaf.cornerRadius ?? 0) * scale.value}px`,
  }
}
</script>

<style scoped lang="scss">
.spread-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $bg-tertiary;
}

.spread-thumb__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spread-thumb__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 150ms ease;
}

// Darkens on hover (or, on touch, on tap — see `--active`) only where an action is actually
// offered (crop/replace/pick — see `spread-thumb__el--actionable`) — elsewhere (admin panels, the
// questionnaire book) hovering a photo shouldn't visibly change anything, since there's no action
// behind it there.
.spread-thumb__el--actionable:hover .spread-thumb__photo,
.spread-thumb__el--active .spread-thumb__photo {
  filter: brightness(0.75);
}

.spread-thumb__photo-empty {
  position: relative;
  width: 100%;
  height: 100%;
  background: $bg-muted;
}

.spread-thumb__pick-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: $white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
  cursor: pointer;
  transition: transform 150ms ease;

  &:hover {
    transform: translate(-50%, -50%) scale(1.08);
  }
}

// Manual placement mode (see `dropEnabled`) — outline instead of border so it never shifts layout.
.spread-thumb__photo--droppable,
.spread-thumb__photo-empty--droppable {
  outline: 2px dashed rgba($accent, 0.55);
  outline-offset: -2px;
}

.spread-thumb__photo--drag-over,
.spread-thumb__photo-empty--drag-over {
  outline-color: $accent;
  filter: brightness(0.88);
}

.spread-thumb__photo-actions {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.spread-thumb__photo-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: $white;
  cursor: pointer;
  transition: transform 150ms ease;

  &:hover {
    transform: scale(1.08);
  }
}

// Hidden until revealed — on a device with real hover, :hover reveals it (see the `@media
// (hover: hover)` block below); on touch, there's no hover to reveal it with, so a tap toggles
// `--active` instead (see `handleElementTap`). Unconditional (not media-gated) so both paths
// share the same hidden default.
.spread-thumb__photo-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}

.spread-thumb__el--active .spread-thumb__photo-actions {
  opacity: 1;
  pointer-events: auto;
}

// Same reasoning/pattern as JournalStructurePanel.vue's own drag/template-switch buttons.
@media (hover: hover) and (pointer: fine) {
  .spread-thumb__el--actionable:hover .spread-thumb__photo-actions {
    opacity: 1;
    pointer-events: auto;
  }
}

.spread-thumb__text {
  padding: 0;
}

.spread-thumb__toc {
  padding: 0;
}

.spread-thumb__toc-entry {
  min-width: 0;
}

.spread-thumb__toc-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spread-thumb__toc-leader {
  flex: 1;
  min-width: 12px;
  align-self: flex-end;
  margin-bottom: 0.2em;
  border-bottom: 1px dotted currentColor;
  opacity: 0.5;
}

.spread-thumb__toc-number {
  flex-shrink: 0;
}

// Stands in for an ai-text-placeholder while its (possibly several-second) YandexGPT round-trip is
// in flight — see `pendingElementIds` — so the wait reads as "generating" (the "Генерируем
// текст ···" label + shimmering line placeholders below, the same visual language as
// ChatGPT/Notion's own "thinking" state) rather than the text silently staying stale, or the
// element going blank, until the save resolves.
.spread-thumb__text-shimmer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8%;
}

.spread-thumb__text-shimmer-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1;
}

.spread-thumb__text-shimmer-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.spread-thumb__text-shimmer-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: spread-thumb-shimmer-dot 1.2s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.15s;
  }
  &:nth-child(3) {
    animation-delay: 0.3s;
  }
}

.spread-thumb__text-shimmer-lines {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  gap: 12%;
}

.spread-thumb__text-shimmer-line {
  height: 22%;
  border-radius: 4px;
  // Widths deliberately uneven (not a uniform block) so this reads as stand-ins for real lines of
  // text rather than one abstract placeholder shape.
  background: linear-gradient(
    90deg,
    rgba($text-muted, 0.14) 25%,
    rgba($text-muted, 0.3) 50%,
    rgba($text-muted, 0.14) 75%
  );
  background-size: 200% 100%;
  animation: spread-thumb-shimmer 1.4s ease-in-out infinite;

  &:nth-child(1) {
    width: 100%;
  }
  &:nth-child(2) {
    width: 85%;
  }
  &:nth-child(3) {
    width: 60%;
  }
}

@keyframes spread-thumb-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes spread-thumb-shimmer-dot {
  0%,
  80%,
  100% {
    opacity: 0.25;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
