<template>
  <div ref="containerRef" class="spread-thumb" :style="rootStyle">
    <div class="spread-thumb__page" :style="pageStyle">
      <img v-if="canvasData.backgroundImageUrl" class="spread-thumb__bg" :src="canvasData.backgroundImageUrl" alt="" />

      <div
        v-for="leaf in leaves"
        :key="leaf.id"
        class="spread-thumb__el"
        :style="elementStyle(leaf)"
      >
        <img
          v-if="isPhotoElement(leaf) && leaf.defaultImageUrl"
          class="spread-thumb__photo"
          :class="{
            'spread-thumb__photo--droppable': dropEnabled,
            'spread-thumb__photo--drag-over': dropEnabled && dragOverElementId === leaf.id,
          }"
          :src="leaf.defaultImageUrl"
          :style="{ borderRadius: `${(leaf.borderRadius ?? 0) * scale}px` }"
          alt=""
          @dragover.prevent="onDragOver(leaf.id)"
          @dragleave="onDragLeave(leaf.id)"
          @drop.prevent="onDrop($event, leaf.id)"
        />
        <div
          v-else-if="isPhotoElement(leaf)"
          class="spread-thumb__photo-empty"
          :class="{
            'spread-thumb__photo-empty--droppable': dropEnabled,
            'spread-thumb__photo-empty--drag-over': dropEnabled && dragOverElementId === leaf.id,
          }"
          @dragover.prevent="onDragOver(leaf.id)"
          @dragleave="onDragLeave(leaf.id)"
          @drop.prevent="onDrop($event, leaf.id)"
        />

        <div v-else-if="isTextElement(leaf)" class="spread-thumb__text" :style="textStyle(leaf)">
          {{ leaf.defaultText }}
        </div>

        <div
          v-else-if="isAiTextElement(leaf) && pendingElementIds.has(leaf.id)"
          class="spread-thumb__text-shimmer"
        >
          <span v-for="n in 3" :key="n" class="spread-thumb__text-shimmer-line" />
        </div>
        <div v-else-if="isAiTextElement(leaf)" class="spread-thumb__text" :style="textStyle(leaf)">
          {{ leaf.previewPlaceholderText }}
        </div>

        <div v-else-if="isShapeElement(leaf)" class="spread-thumb__shape" :style="shapeStyle(leaf)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { AiTextPlaceholder, CanvasData, LeafElement, ShapeElement, TextPlaceholder } from '../models'
import { isAiTextElement, isPhotoElement, isShapeElement, isTextElement } from '../models'
import { flattenTree } from '../utils/element-tree.util'
import { ensureCustomFontsLoaded } from '../utils/custom-fonts.util'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '../constants/page.constants'

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
  }>(),
  { pendingElementIds: () => new Set(), dropEnabled: false },
)

const emit = defineEmits<{
  'drop-photo': [elementId: string, url: string]
}>()

const dragOverElementId = ref<string | null>(null)

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
  backgroundColor: props.canvasData.backgroundColor ?? '#FFFFFF',
  overflow: 'hidden' as const,
}))

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
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

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
}

.spread-thumb__photo-empty {
  width: 100%;
  height: 100%;
  background: $bg-muted;
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

.spread-thumb__text {
  padding: 0;
}

// Stands in for an ai-text-placeholder while its (possibly several-second) YandexGPT round-trip is
// in flight — see `pendingElementIds` — so the wait reads as "generating" rather than the text
// silently staying stale, or the element going blank, until the save resolves.
.spread-thumb__text-shimmer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12%;
}

.spread-thumb__text-shimmer-line {
  height: 22%;
  border-radius: 4px;
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
</style>
