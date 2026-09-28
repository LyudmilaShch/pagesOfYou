<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="handleDialogUpdate">
    <v-card
      class="photo-crop__card"
      @wheel="onWheel"
      @gesturestart.prevent="handleNativeGesture"
      @gesturechange.prevent="handleNativeGesture"
    >
      <v-card-title>Кадрировать фото</v-card-title>
      <v-card-subtitle>
        <span class="photo-crop__hint-mobile">Перетащите фото, чтобы сдвинуть, и сведите/разведите пальцы, чтобы приблизить</span>
        <span class="photo-crop__hint-desktop">Перетащите фото, чтобы сдвинуть, и потяните ползунок, чтобы приблизить</span>
      </v-card-subtitle>
      <v-divider />

      <v-card-text>
        <div
          class="photo-crop__area"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel="onWheel"
          @gesturestart.prevent="handleNativeGesture"
          @gesturechange.prevent="handleNativeGesture"
        >
          <div ref="frameRef" class="photo-crop__slot" :style="slotRectStyle">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              class="photo-crop__image"
              :style="imageStyle"
              draggable="false"
              alt=""
              @load="handleImageLoad"
            />
          </div>
          <div class="photo-crop__bleed-mask" :style="areaMaskStyle.top" />
          <div class="photo-crop__bleed-mask" :style="areaMaskStyle.bottom" />
          <div class="photo-crop__bleed-mask" :style="areaMaskStyle.left" />
          <div class="photo-crop__bleed-mask" :style="areaMaskStyle.right" />
          <div class="photo-crop__safe-area" :style="slotRectStyle" />
        </div>
        <p v-if="hasBleed" class="photo-crop__bleed-hint">
          Затемнённые края уйдут под обрез — на странице будет видна только область в рамке
        </p>

        <div class="photo-crop__zoom">
          <v-icon size="16" color="grey">mdi-magnify-minus-outline</v-icon>
          <v-slider
            :model-value="crop.imageScale"
            :min="MIN_PHOTO_IMAGE_SCALE"
            :max="MAX_PHOTO_IMAGE_SCALE"
            :step="0.01"
            :disabled="!naturalSize"
            hide-details
            color="primary"
            @update:model-value="onScaleChange"
          />
          <v-icon size="16" color="grey">mdi-magnify-plus-outline</v-icon>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="photo-crop__actions">
        <v-btn variant="text" @click="resetCrop">Сбросить</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Отмена</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="!naturalSize" @click="save">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import type { PhotoFitMode } from '@/modules/editor/models'
import {
  MAX_PHOTO_IMAGE_SCALE,
  MIN_PHOTO_IMAGE_SCALE,
  clampPhotoCrop,
  computePhotoCropFromPanDelta,
  computePhotoCropZoomAtPoint,
  computePhotoImageLayout,
  resolvePhotoRenderFitMode,
  type PhotoCoverArea,
  type PhotoCropState,
} from '@/modules/editor/utils/photo-crop.util'

const props = defineProps<{
  open: boolean
  imageUrl: string | null
  boxWidth: number
  boxHeight: number
  fitMode?: PhotoFitMode
  initialCrop: PhotoCropState
  loading?: boolean
  /** The portion of the box (in the same px space as boxWidth/boxHeight) that will actually be
   * visible on the page — for a full-bleed placeholder, the box itself can be larger than the
   * page, so most of it gets clipped away. Omit/null when the box is fully on-page (nothing to
   * highlight): the dashed slot below then represents the whole box instead. */
  visibleRect?: { x: number; y: number; width: number; height: number } | null
}>()

const emit = defineEmits<{
  close: []
  save: [crop: PhotoCropState]
}>()

const resolvedFitMode = computed(() => resolvePhotoRenderFitMode(props.fitMode))

// "Cover" must only guarantee no gaps within what's actually visible on the page — for an
// ordinary (fully on-page) placeholder that's the whole box (undefined, unchanged behavior); for
// a full-bleed one it's the smaller, page-clipped `visibleRect`, so the minimum zoom stops being
// stricter than necessary and the crop preview matches what JournalSpreadThumbnail.vue prints.
const coverArea = computed<PhotoCoverArea | undefined>(() => props.visibleRect ?? undefined)

// Same value as `coverArea`, just with the "whole box" default spelled out instead of undefined —
// this is what the dashed slot below is actually shaped/sized as: the true used area, at its real
// proportions (never artificially shrunk), whether that's the whole placeholder or, for a
// full-bleed one, just the page-visible part of it.
const effectiveArea = computed<PhotoCoverArea>(
  () => props.visibleRect ?? { x: 0, y: 0, width: props.boxWidth, height: props.boxHeight },
)

const crop = reactive<PhotoCropState>({ cropX: 0, cropY: 0, imageScale: 1 })
const naturalSize = ref<{ width: number; height: number } | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    dragStart = null
    activePointers.clear()
    pinchStartDistance = 0
    pinchStartCrop = null
    pinchStartMid = null
    pinchFocalBoxPoint = null
    if (isOpen) {
      crop.cropX = props.initialCrop.cropX
      crop.cropY = props.initialCrop.cropY
      crop.imageScale = props.initialCrop.imageScale
      naturalSize.value = null
    }
  },
)

function handleImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement
  naturalSize.value = { width: img.naturalWidth, height: img.naturalHeight }
}

// `.photo-crop__area` is always a fixed square, the same for every photo, so the dialog itself
// never changes shape. `.photo-crop__slot` inside it is a "contain" fit of `effectiveArea`'s real
// proportions (with a fixed padding, so a margin always exists even for a square photo) — this is
// what actually represents the used area; everything below keeps positioning the image relative
// to THAT box. `.photo-crop__slot` deliberately does not clip: any part of the image outside it
// (ordinary cover-fit slack, or genuine bleed for a full-bleed placeholder) stays visible, spilling
// into the square's margin, where the dark mask bands (painted after it, so on top) dim it.
const SLOT_PADDING_PCT = 10

const slotRectPct = computed(() => {
  const area = effectiveArea.value
  if (area.width <= 0 || area.height <= 0) {
    return { left: 0, top: 0, width: 100, height: 100 }
  }

  const available = 100 - SLOT_PADDING_PCT * 2
  const aspect = area.width / area.height
  const widthPct = aspect >= 1 ? available : available * aspect
  const heightPct = aspect >= 1 ? available / aspect : available

  return {
    left: (100 - widthPct) / 2,
    top: (100 - heightPct) / 2,
    width: widthPct,
    height: heightPct,
  }
})

const slotRectStyle = computed(() => {
  const r = slotRectPct.value
  return { left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` }
})

const areaMaskStyle = computed(() => {
  const r = slotRectPct.value
  const rightPct = r.left + r.width
  const bottomPct = r.top + r.height

  return {
    top: { left: '0%', top: '0%', width: '100%', height: `${r.top}%` },
    bottom: { left: '0%', top: `${bottomPct}%`, width: '100%', height: `${100 - bottomPct}%` },
    left: { left: '0%', top: `${r.top}%`, width: `${r.left}%`, height: `${r.height}%` },
    right: { left: `${rightPct}%`, top: `${r.top}%`, width: `${100 - rightPct}%`, height: `${r.height}%` },
  }
})

const imageStyle = computed(() => {
  if (!naturalSize.value) {
    return { width: '100%', height: '100%', objectFit: 'cover' as const }
  }

  const layout = computePhotoImageLayout(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
    coverArea.value,
  )
  if (!layout) {
    return { width: '100%', height: '100%', objectFit: 'cover' as const }
  }

  // `layout` is in the full-box coordinate space (computePhotoImageLayout already accounts for
  // coverArea's own offset within it) — remapped here to be relative to the SLOT's box, which
  // represents `effectiveArea`, not the full box, so it renders at the right place/size inside it.
  const area = effectiveArea.value

  return {
    position: 'absolute' as const,
    left: `${((layout.x - area.x) / area.width) * 100}%`,
    top: `${((layout.y - area.y) / area.height) * 100}%`,
    width: `${(layout.width / area.width) * 100}%`,
    height: `${(layout.height / area.height) * 100}%`,
    maxWidth: 'none',
    cursor: 'grab',
    touchAction: 'none',
  }
})

// Whether the visible rect actually excludes part of the box — an ordinary, fully-on-page
// placeholder has nothing bleeding off-page, so the "gets cropped" hint below would be misleading.
const hasBleed = computed(() => {
  const rect = props.visibleRect
  if (!rect || props.boxWidth <= 0 || props.boxHeight <= 0) {
    return false
  }
  const EPSILON = 0.5
  return !(
    rect.x <= EPSILON &&
    rect.y <= EPSILON &&
    rect.x + rect.width >= props.boxWidth - EPSILON &&
    rect.y + rect.height >= props.boxHeight - EPSILON
  )
})

// Percentages above (not px via a ResizeObserver-measured scale, unlike JournalSpreadThumbnail.vue)
// — the slot's own box-relative % position/size stays correct at any rendered width for free, so
// panning below just needs the slot's CURRENT pixel width to convert a screen-px drag delta into
// the same unscaled page-point space `computePhotoCropFromPanDelta` expects.
const frameRef = ref<HTMLElement | null>(null)

function handleNativeGesture(): void {
  // Safari's own proprietary gesturestart/gesturechange pinch recognition (see the identical note
  // on QuestionnaireBook.vue's preventNativeGestureZoom) bypasses touch-action entirely — without
  // this, a pinch here can still zoom the whole page instead of just the photo on Safari. The
  // `.prevent` modifier above already calls preventDefault(); this only needs to exist to attach.
}

let dragStart: { pointerId: number; x: number; y: number; cropX: number; cropY: number } | null = null

// Pinch-to-zoom: a second finger landing turns single-finger panning into a two-finger pinch —
// both distance (→ scale) and midpoint (→ pan) are tracked from a FIXED snapshot of the crop state
// taken at the moment the SECOND finger touched down (`pinchStartCrop`/`pinchStartMid`/
// `pinchFocalBoxPoint`), so every pointermove tick recomputes from that same anchor rather than
// compounding small errors frame over frame (same reasoning as QuestionnaireBook.vue's own pinch).
const activePointers = new Map<number, { x: number; y: number }>()
let pinchStartDistance = 0
let pinchStartCrop: PhotoCropState | null = null
let pinchStartMid: { x: number; y: number } | null = null
let pinchFocalBoxPoint: { x: number; y: number } | null = null

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pointerMidpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Converts a screen point to the same unscaled box-local coordinate space `computePhotoImageLayout`
 * works in (0,0 = the placeholder's own top-left) — via the SLOT's rendered rect, which represents
 * `effectiveArea` (not the full box), so the pinch's focal point lands under the same photo detail
 * regardless of whether this is an ordinary or full-bleed placeholder. */
function screenToBoxPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const el = frameRef.value
  if (!el) {
    return null
  }
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }
  const area = effectiveArea.value
  return {
    x: area.x + ((clientX - rect.left) / rect.width) * area.width,
    y: area.y + ((clientY - rect.top) / rect.height) * area.height,
  }
}

// A trackpad pinch (no real touchscreen — a laptop trackpad, or Chrome DevTools' device-emulation
// mode with one) never fires a second `pointerdown` at all: OS-level gesture recognition turns it
// into a synthetic `wheel` event with `ctrlKey: true` instead (the same event literal Ctrl+scroll
// produces), entirely separate from the touch-driven pinch above (see QuestionnaireBook.vue's
// identical `handleZoomWheel`, which this mirrors) — left unhandled, its default action is the
// BROWSER's own page zoom, exactly the "general zoom fires" symptom this exists to prevent.
const WHEEL_ZOOM_SENSITIVITY = 0.01

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey || !naturalSize.value) {
    // A plain (non-pinch) wheel/trackpad scroll — leave it alone; only a pinch (or literal
    // Ctrl+scroll) synthesizes ctrlKey here, and only that should be treated as a zoom gesture.
    return
  }
  event.preventDefault()

  const area = effectiveArea.value
  const focal = screenToBoxPoint(event.clientX, event.clientY) ?? {
    x: area.x + area.width / 2,
    y: area.y + area.height / 2,
  }
  const scaleDelta = -event.deltaY * WHEEL_ZOOM_SENSITIVITY * crop.imageScale

  const next = computePhotoCropZoomAtPoint(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
    focal.x,
    focal.y,
    scaleDelta,
    coverArea.value,
  )
  crop.cropX = next.cropX
  crop.cropY = next.cropY
  crop.imageScale = next.imageScale
}

function onPointerDown(event: PointerEvent): void {
  if (!naturalSize.value) {
    return
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size === 2) {
    dragStart = null
    const [a, b] = [...activePointers.values()]
    pinchStartDistance = pointerDistance(a, b)
    pinchStartCrop = { ...crop }
    pinchStartMid = pointerMidpoint(a, b)
    pinchFocalBoxPoint = screenToBoxPoint(pinchStartMid.x, pinchStartMid.y)
    return
  }

  if (activePointers.size === 1) {
    dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cropX: crop.cropX, cropY: crop.cropY }
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!naturalSize.value || !activePointers.has(event.pointerId)) {
    return
  }
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (
    activePointers.size === 2 &&
    pinchStartDistance > 0 &&
    pinchStartCrop &&
    pinchStartMid &&
    pinchFocalBoxPoint &&
    frameRef.value
  ) {
    const [a, b] = [...activePointers.values()]
    const distance = pointerDistance(a, b)
    if (distance <= 0) {
      return
    }
    const targetScale = Math.min(
      MAX_PHOTO_IMAGE_SCALE,
      Math.max(MIN_PHOTO_IMAGE_SCALE, pinchStartCrop.imageScale * (distance / pinchStartDistance)),
    )

    // Step 1: zoom anchored at the gesture's START midpoint, so that spot stays under the fingers.
    const zoomed = computePhotoCropZoomAtPoint(
      props.boxWidth,
      props.boxHeight,
      naturalSize.value.width,
      naturalSize.value.height,
      resolvedFitMode.value,
      pinchStartCrop,
      pinchFocalBoxPoint.x,
      pinchFocalBoxPoint.y,
      targetScale - pinchStartCrop.imageScale,
      coverArea.value,
    )

    // Step 2: additionally pan by how far the midpoint itself has drifted since then — dragging
    // both fingers together (not just spreading/pinching them) looks around, same as any pinch.
    const mid = pointerMidpoint(a, b)
    const rect = frameRef.value.getBoundingClientRect()
    const area = effectiveArea.value
    const dxBox = rect.width > 0 ? ((mid.x - pinchStartMid.x) / rect.width) * area.width : 0
    const dyBox = rect.height > 0 ? ((mid.y - pinchStartMid.y) / rect.height) * area.height : 0

    const panned = clampPhotoCrop(
      props.boxWidth,
      props.boxHeight,
      naturalSize.value.width,
      naturalSize.value.height,
      resolvedFitMode.value,
      { cropX: zoomed.cropX + dxBox, cropY: zoomed.cropY + dyBox, imageScale: zoomed.imageScale },
      coverArea.value,
    )
    crop.cropX = panned.cropX
    crop.cropY = panned.cropY
    crop.imageScale = panned.imageScale
    event.preventDefault()
    return
  }

  if (!dragStart || dragStart.pointerId !== event.pointerId || !frameRef.value) {
    return
  }

  const pixelsPerPoint = frameRef.value.clientWidth / effectiveArea.value.width
  if (pixelsPerPoint <= 0) {
    return
  }

  const deltaX = (event.clientX - dragStart.x) / pixelsPerPoint
  const deltaY = (event.clientY - dragStart.y) / pixelsPerPoint

  const next = computePhotoCropFromPanDelta(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    { cropX: dragStart.cropX, cropY: dragStart.cropY, imageScale: crop.imageScale },
    deltaX,
    deltaY,
    coverArea.value,
  )
  crop.cropX = next.cropX
  crop.cropY = next.cropY
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  if (activePointers.size < 2) {
    pinchStartDistance = 0
    pinchStartCrop = null
    pinchStartMid = null
    pinchFocalBoxPoint = null
  }
  if (dragStart?.pointerId === event.pointerId) {
    dragStart = null
  }
}

function onScaleChange(nextScale: number): void {
  if (!naturalSize.value) {
    return
  }

  const area = effectiveArea.value
  const next = computePhotoCropZoomAtPoint(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
    area.x + area.width / 2,
    area.y + area.height / 2,
    nextScale - crop.imageScale,
    coverArea.value,
  )
  crop.cropX = next.cropX
  crop.cropY = next.cropY
  crop.imageScale = next.imageScale
}

function resetCrop(): void {
  crop.cropX = 0
  crop.cropY = 0
  crop.imageScale = 1
}

function save(): void {
  if (!naturalSize.value) {
    return
  }

  const clamped = clampPhotoCrop(
    props.boxWidth,
    props.boxHeight,
    naturalSize.value.width,
    naturalSize.value.height,
    resolvedFitMode.value,
    crop,
    coverArea.value,
  )
  emit('save', clamped)
}

function handleDialogUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}

onBeforeUnmount(() => {
  dragStart = null
  activePointers.clear()
  pinchStartDistance = 0
  pinchStartCrop = null
  pinchStartMid = null
  pinchFocalBoxPoint = null
})
</script>

<style scoped lang="scss">
.photo-crop__card {
  // touch-action is computed per gesture from EVERY touch point's own element AND its ancestors —
  // a pinch with one finger on the crop area and the other just outside it (on this card's own
  // title/subtitle/padding) still triggers the browser's native page pinch-zoom unless NONE of
  // those ancestors allow it either. Blocking it card-wide (nothing here needs native touch
  // scrolling — v-slider/v-btn already drive their own dragging/taps through pointer events, not
  // native touch panning, so this doesn't affect them) is what actually closes that gap.
  touch-action: none;
}

// Vuetify's v-card-subtitle defaults to single-line truncation (white-space: nowrap +
// text-overflow: ellipsis), meant for short titles — this one is a full instructional sentence
// that's routinely wider than the dialog, so it needs to wrap onto a second line instead of
// getting cut off with "…".
:deep(.v-card-subtitle) {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  line-height: 1.35;
  padding-bottom: $spacing-2;
}

.photo-crop__actions {
  @include mobile-only {
    .v-btn {
      height: 32px;
      padding-inline: 10px;
      font-size: 12px;

      :deep(.v-btn__content) {
        font-size: 12px;
      }
    }
  }
}

.photo-crop__area {
  position: relative;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  overflow: hidden;
  border-radius: $radius-md;
  background: $bg-muted;
  // Pointer handlers are on THIS element (not just the <img>/slot inside it — see the template),
  // since a pinch's two fingers can easily land partly on the gray margin around the slot, not
  // just on the photo itself. touch-action has to cover that same full area, or a finger landing
  // there still triggers the browser's own native pinch-zoom on the whole page instead of this
  // handler (same reasoning as QuestionnaireBook.vue applying it to its outer perspective wrapper,
  // not just the inner zoom layer).
  touch-action: none;
}

.photo-crop__slot {
  position: absolute;
  // Deliberately not clipped — a photo's own cover-fit slack (or, for a full-bleed placeholder,
  // its actual bleed margin) stays visible past this box's own edge, spilling into the square
  // area's margin, where the dark mask bands (siblings painted after this) dim it. The dashed
  // outline marking this box's own edge is a separate sibling div too — an `outline` set directly
  // here would paint UNDER the <img> below, which fills the box and would hide it completely.
  overflow: visible;
}

.photo-crop__image {
  user-select: none;
}

.photo-crop__bleed-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.photo-crop__safe-area {
  position: absolute;
  outline: 1.5px dashed rgba(255, 255, 255, 0.85);
  outline-offset: -1.5px;
  pointer-events: none;
}

.photo-crop__bleed-hint {
  margin: $spacing-2 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: $text-muted;
  text-align: center;
}

.photo-crop__hint-mobile {
  display: none;

  @include mobile-only {
    display: inline;
  }
}

.photo-crop__hint-desktop {
  @include mobile-only {
    display: none;
  }
}

.photo-crop__zoom {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  margin-top: $spacing-4;

  // Redundant with pinch/trackpad zoom (see onPointerMove's pinch branch and onWheel) on mobile,
  // where it's just a fiddly, small-touch-target way to do the same thing the fingers already do
  // directly on the photo. Kept for desktop mouse users, who have no pinch gesture available.
  @include mobile-only {
    display: none;
  }
}
</style>
