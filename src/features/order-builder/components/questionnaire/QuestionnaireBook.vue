<template>
  <div class="questionnaire-book" :class="{ 'questionnaire-book--fit-height': fitHeight }">
    <div
      ref="perspectiveRef"
      class="questionnaire-book__perspective"
      :class="{
        'questionnaire-book__perspective--zoomed': zoomScale > 1,
        'questionnaire-book__perspective--zoom-enabled': zoomEnabled,
        'questionnaire-book__perspective--page-mode': pageModeEnabled,
      }"
    >
      <!-- Page mode (mobile, see pageModeBothSidesActive): an OUTER transform layer that enlarges
           the whole spread and pans it to keep the active half centered — same "camera" idea as
           pinch-zoom below, just automatic/anchored per half instead of user-driven, and on a
           SEPARATE layer so the two compose independently (a pinch further in still works normally
           on top of this). See `pageModeLayerStyle`/`handlePageSwipe*` for the mechanics. -->
      <div
        ref="pageModeLayerRef"
        class="questionnaire-book__page-mode-layer"
        :class="{
          'questionnaire-book__page-mode-layer--enabled': pageModeEnabled,
          'questionnaire-book__page-mode-layer--gesture': swipeGestureActive,
          'questionnaire-book__page-mode-layer--clipped': pageModeCentered,
        }"
        :style="pageModeLayerStyle"
        @pointerdown="handlePageSwipePointerDown"
        @pointermove="handlePageSwipePointerMove"
        @pointerup="handlePageSwipePointerUp"
        @pointercancel="handlePageSwipePointerCancel"
      >
        <!-- Pinch-to-zoom + double-tap (only when `zoomEnabled` — see that prop's doc comment) — a
             separate transform layer around the frame, not on the frame itself, so it doesn't fight
             with the frame's own CSS `rotateX` tilt (two independent transforms compose naturally
             when nested instead of needing to be combined into one string). See
             `handleZoomPointer*` for the gesture logic — entirely unaware of the page-mode layer
             wrapping it, its own `zoomScale`/`zoomX`/`zoomY` stay relative to THIS layer's already-
             enlarged view, exactly like they'd be relative to an un-enlarged one otherwise. -->
        <div
          ref="zoomLayerRef"
          class="questionnaire-book__zoom-layer"
          :class="{
            'questionnaire-book__zoom-layer--enabled': zoomEnabled,
            'questionnaire-book__zoom-layer--gesture': zoomGestureActive,
            'questionnaire-book__zoom-layer--page-mode-centered': pageModeCentered,
          }"
          :style="zoomEnabled ? zoomLayerStyle : undefined"
          @pointerdown="zoomEnabled && handleZoomPointerDown($event)"
          @pointermove="zoomEnabled && handleZoomPointerMove($event)"
          @pointerup="zoomEnabled && handleZoomPointerUp($event)"
          @pointercancel="zoomEnabled && handleZoomPointerCancel($event)"
          @click.capture="(zoomEnabled || pageModeEnabled) && handleZoomClickCapture($event)"
          @wheel="zoomEnabled && handleZoomWheel($event)"
        >
          <div
            ref="frameRef"
            class="questionnaire-book__frame"
            :class="{
              'questionnaire-book__frame--pulse': viewingPageId && pulsingPageIds.has(viewingPageId),
              'questionnaire-book__frame--page-mode': pageModeCentered,
            }"
            :style="frameStyle"
          >
          <div class="questionnaire-book__halves">
            <div
              v-for="half in renderedHalves"
              :key="half.key"
              class="questionnaire-book__half"
              :style="{ left: half.left, width: half.width }"
            >
              <div class="questionnaire-book__window" :data-page-id="half.pageId" :style="{ left: half.windowLeft, width: half.windowWidth }">
                <JournalSpreadThumbnail
                  v-if="half.canvasData"
                  :canvas-data="half.canvasData"
                  :pending-element-ids="pendingElementIds"
                  :drop-enabled="dropEnabled"
                  :crop-enabled="cropEnabled"
                  :pick-enabled="pickEnabled"
                  :ai-text-edit-enabled="aiTextEditEnabled"
                  :toc-entries="tocEntriesFor(half.pageId)"
                  :visible-half="isSpreadPage(half.pageId) ? half.key : undefined"
                  @drop-photo="(elementId, url) => emit('drop-photo', half.pageId, elementId, url)"
                  @crop-photo="(elementId) => emit('crop-photo', half.pageId, elementId)"
                  @pick-photo="(elementId) => emit('pick-photo', half.pageId, elementId)"
                  @edit-ai-text="(elementId) => emit('edit-ai-text', half.pageId, elementId)"
                  @regenerate-ai-text="(elementId) => emit('regenerate-ai-text', half.pageId, elementId)"
                />
              </div>
            </div>

            <div v-if="leftPageId && rightPageId" class="questionnaire-book__spine" />
          </div>

          <span
            v-if="viewingFill && viewingFill.answered > 0 && viewingFill.answered < viewingFill.total"
            class="questionnaire-book__badge questionnaire-book__badge--partial"
          >
            {{ Math.round((viewingFill.answered / viewingFill.total) * 100) }}%
          </span>

          <v-tooltip v-if="!turning && showStructureControls" location="top" content-class="editor-tooltip--arrow-top">
            <template #activator="{ props: tooltipProps }">
              <button
                v-bind="tooltipProps"
                type="button"
                class="questionnaire-book__template-btn"
                aria-label="Сменить шаблон разворота"
                :style="{ '--page-mode-btn-scale': pageModeButtonScale }"
                @click="openTemplatePicker"
              >
                <v-icon size="16">mdi-view-grid-outline</v-icon>
              </button>
            </template>
            Сменить шаблон
          </v-tooltip>

          <div
            v-if="turning && flapGeometry"
            class="questionnaire-book__flap"
            :style="{
              left: flapGeometry.left,
              width: flapGeometry.width,
              transformOrigin: flapGeometry.origin,
              transform: `rotateY(${turnAngle}deg)`,
            }"
          >
            <div class="questionnaire-book__flap-face questionnaire-book__flap-face--front">
              <div v-if="flapFrontWindow" class="questionnaire-book__window" :style="{ left: flapFrontWindow.left, width: flapFrontWindow.width }">
                <JournalSpreadThumbnail
                  v-if="flapFrontCanvasData"
                  :canvas-data="flapFrontCanvasData"
                  :pending-element-ids="pendingElementIds"
                />
              </div>
            </div>
            <div class="questionnaire-book__flap-face questionnaire-book__flap-face--back">
              <div v-if="flapBackWindow" class="questionnaire-book__window" :style="{ left: flapBackWindow.left, width: flapBackWindow.width }">
                <JournalSpreadThumbnail
                  v-if="flapBackCanvasData"
                  :canvas-data="flapBackCanvasData"
                  :pending-element-ids="pendingElementIds"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- For a caller overlaying its own controls directly on the book stage (e.g.
           PhotoUploadPage.vue's round prev/next arrows) — positioned here, not around the whole
           component, so `position: absolute; top: 50%` on that content centers against the FRAME's
           own box specifically (this wrapper only ever holds the frame, unlike the component's own
           root, which also stacks the toolbar row below it). -->
      <slot name="nav-overlay" />
    </div>

    <div v-if="!hideNav" class="questionnaire-book__nav">
      <button
        type="button"
        class="questionnaire-book__arrow"
        :disabled="viewingIndex <= 0 || turning"
        aria-label="Предыдущая страница"
        @click="flip('prev')"
      >
        <v-icon size="18">mdi-chevron-left</v-icon>
      </button>

      <span class="questionnaire-book__counter text-caption text-secondary">
        {{ viewingLabel }} · {{ viewingIndex + 1 }} из {{ pages.length }}
      </span>

      <button
        type="button"
        class="questionnaire-book__arrow"
        :disabled="viewingIndex >= pages.length - 1 || turning"
        aria-label="Следующая страница"
        @click="flip('next')"
      >
        <v-icon size="18">mdi-chevron-right</v-icon>
      </button>
    </div>

    <div v-if="showStructureControls" class="questionnaire-book__toolbar">
      <button
        type="button"
        class="questionnaire-book__reorder-btn"
        @click="spreadManagerOpen = true"
      >
        <v-icon size="16">mdi-view-carousel-outline</v-icon>
        <span class="questionnaire-book__btn-label-full">Управление разворотами</span>
        <span class="questionnaire-book__btn-label-short">Развороты</span>
      </button>

      <!-- Mobile only — lets a visitor opt out of page mode's auto-enlarged single-page view back
           into the desktop-style "whole spread at once" layout, and back. -->
      <button
        v-if="isMobileViewport"
        type="button"
        class="questionnaire-book__view-toggle"
        :aria-label="spreadViewForced ? 'Показать постранично' : 'Показать разворотом'"
        @click="toggleViewFormat"
      >
        <v-icon size="16">{{ spreadViewForced ? 'mdi-book-open-page-variant-outline' : 'mdi-book-open-outline' }}</v-icon>
      </button>
    </div>

    <SpreadManagerDialog
      :open="spreadManagerOpen"
      :pages="pages"
      :canvas-data-by-page-id="canvasDataByPageId"
      @close="spreadManagerOpen = false"
    />

    <JournalTemplatePickerDialog
      :open="templatePicker.open"
      :journal-page="templatePicker.page"
      :templates="store.groupedTemplates"
      :loading="store.isSaving"
      @close="closeTemplatePicker"
      @apply="handleApplyTemplate"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import type { TocEntry } from '@/modules/editor/models/toc-placeholder.model'
import { useMobileViewport } from '@/modules/editor/composables/use-mobile-viewport'
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import { buildTocEntries, getJournalPageDisplayName } from '../../utils/journal-structure.util'
import type { JournalPage } from '../../types/order.types'
import type { SetJournalPageTemplatePayload } from '../../api/orders.api'
import { useOrderBuilderStore } from '../../stores/order-builder.store'
import JournalTemplatePickerDialog from '../JournalTemplatePickerDialog.vue'
import SpreadManagerDialog from './SpreadManagerDialog.vue'

const store = useOrderBuilderStore()

// The frame's own shape switches between these two: full spread width/ratio whenever both halves
// are (or are about to be — see `frameStyle`) in play, a single page's width/ratio when only a lone
// cover is showing — so its box-shadow hugs the cover's real bounds instead of a half-empty spread.
const SPREAD_ASPECT_RATIO = A4_SPREAD_PAGE_WIDTH / A4_SPREAD_PAGE_HEIGHT
const PAGE_ASPECT_RATIO = A4_PAGE_WIDTH / A4_PAGE_HEIGHT

const props = defineProps<{
  pages: JournalPage[]
  canvasDataByPageId: Map<string, CanvasData>
  /** Where the book should jump to (no flip animation) when this changes — e.g. the wizard moved
   * to a question bound to a different spread. Manual flipping afterwards is unaffected until this
   * changes again. */
  focusPageId: string | null
  pulsingPageIds: Set<string>
  fillByPageId: Map<string, { answered: number; total: number }>
  /** ai-text-placeholder element ids currently mid-generation — forwarded to every
   * `JournalSpreadThumbnail` so it can show a shimmer instead of stale/blank preview text. */
  pendingElementIds: Set<string>
  /** Manual photo-placement mode (see PhotoUploadPage.vue) — forwarded to every
   * `JournalSpreadThumbnail` so its photo-placeholders become drop targets. */
  dropEnabled: boolean
  /** Shows a crop button on every filled photo (see PhotoUploadPage.vue's PhotoCropModal) —
   * forwarded to every `JournalSpreadThumbnail`, defaults off since only Шаг 2 offers cropping. */
  cropEnabled?: boolean
  /** Shows an "add photo" button on every empty slot (see PhotoUploadPage.vue's gallery picker) —
   * forwarded to every `JournalSpreadThumbnail`, defaults off for the same reason as `cropEnabled`. */
  pickEnabled?: boolean
  /** Shows "edit text"/"regenerate" buttons on every settled ai-text-placeholder (see
   * QuestionnairePage.vue's AiTextEditModal) — forwarded to every `JournalSpreadThumbnail`,
   * defaults off since only Шаг 3 (where the text actually gets generated) offers this. */
  aiTextEditEnabled?: boolean
  /** Hides the per-spread "Сменить шаблон" button and the "Изменить порядок разворотов"/"Добавить
   * 4 страницы" toolbar — for contexts where restructuring the journal would be a distraction from
   * (or work against) the task at hand, e.g. MissingPhotosModal.vue, where adding more spreads
   * would only create more empty photo slots to fill. Defaults on, since every other caller wants
   * the full structure controls. */
  showStructureControls?: boolean
  /** Sizes the frame from the height its parent gives it instead of the width — every other
   * caller puts this in a fixed-width column and lets width drive a naturally-computed height, but
   * JournalReviewPage.vue instead gives it a fixed-HEIGHT area (so the whole step fits one screen
   * with no scroll on desktop) and needs the frame to shrink to fit that instead. */
  fitHeight?: boolean
  /** Hides the built-in prev/next arrows + "N из M" counter row below the frame — for a caller
   * that wants to build its own nav UI around the same position (see the `update:viewing` emit
   * below) instead, e.g. PhotoUploadPage.vue's mobile layout. Defaults off; every other caller
   * keeps the built-in nav unchanged. */
  hideNav?: boolean
  /** Lets the visitor pinch-zoom (and double-tap-to-zoom) into the frame, panning around while
   * zoomed in, without affecting the surrounding page's own scale — for callers where getting a
   * closer look at a photo/text actually matters (PhotoUploadPage.vue, JournalReviewPage.vue).
   * Defaults off — QuestionnairePage.vue's book is a small side reference, not something a visitor
   * needs to inspect closely. See `handleZoomPointerDown` for the gesture implementation. */
  zoomEnabled?: boolean
}>()

const showStructureControls = computed(() => props.showStructureControls ?? true)

const emit = defineEmits<{
  /** A photo was dropped onto a photo-placeholder on the given page — re-emitted from
   * `JournalSpreadThumbnail`'s own `drop-photo` with page context added, since that component
   * only knows the canvas data it was handed, not which journal page it belongs to. */
  'drop-photo': [pageId: string, elementId: string, url: string]
  /** The crop button on a filled photo was clicked — same page-context re-emit as `drop-photo`. */
  'crop-photo': [pageId: string, elementId: string]
  /** The "add photo" button on an empty slot was clicked — same page-context re-emit. */
  'pick-photo': [pageId: string, elementId: string]
  /** The "edit text" button on an ai-text-placeholder was clicked — same page-context re-emit. */
  'edit-ai-text': [pageId: string, elementId: string]
  /** The "regenerate" button on an ai-text-placeholder was clicked — same page-context re-emit. */
  'regenerate-ai-text': [pageId: string, elementId: string]
  /** Mirrors the built-in nav's own "N из M" position — fires whenever it changes, for a caller
   * using `hideNav` to build its own nav UI (see that prop's own doc comment) from the same state. */
  'update:viewing': [payload: { index: number; total: number; label: string }]
  /** Fires whenever the mobile view-format toggle (`.questionnaire-book__view-toggle`) changes —
   * `true` once the visitor has manually switched back to the desktop-style "whole spread" layout
   * (see `spreadViewForced`). A caller that gives page mode extra vertical headroom to enlarge into
   * (PhotoUploadPage.vue's own taller mobile book-column) can listen for this to shrink back down
   * again in spread view, where that headroom just sits empty instead of being used for anything. */
  'update:spread-view': [forced: boolean]
}>()

// Real table-of-contents rows for every toc-placeholder in the book — computed once from the
// actual page list (real page numbers only exist per order/template instance, see
// journal-structure.util.ts's buildTocEntries), then each half gets its own page excluded so a
// toc-placeholder never lists the spread it's sitting on.
const fullTocEntries = computed(() => buildTocEntries(props.pages))

function tocEntriesFor(pageId: string): TocEntry[] {
  return fullTocEntries.value.filter((entry) => entry.pageId !== pageId)
}

// A COVER sits where a book's front cover really is — the right side, with nothing (yet) to its
// left. A BACK_COVER mirrors that on the left, with nothing to its right. A SPREAD — and a TOC,
// built on the same spread-width canvas (see journal-structure.util.ts's buildJournalPageSnapshot)
// — occupies both sides at once (the same canvas, windowed into two halves — see `windowFor`
// below).
function sidesFor(page: JournalPage | undefined): { left: string | null; right: string | null } {
  if (!page) {
    return { left: null, right: null }
  }
  if (page.slotType === 'SPREAD' || page.slotType === 'TOC') {
    return { left: page.id, right: page.id }
  }
  return page.slotType === 'COVER' ? { left: null, right: page.id } : { left: page.id, right: null }
}

// `viewingPageId` is the fully-settled page — the source of truth for the index/label/badge/pulse
// and for computing the next flip's target. `leftPageId`/`rightPageId` are what each half actually
// renders, and briefly disagree with it (and each other) during a flip: like a real book, the near
// half (right for 'next', left for 'prev') keeps showing the outgoing page for the first beat — the
// leaf visibly lifts off it before it's revealed — then swaps to the target the instant the leaf
// starts peeling away (which may mean it becomes empty, e.g. the right side going blank as the last
// spread turns to the back cover). The far half only catches up once the turning leaf lands, at
// which point `viewingPageId` settles onto the target too.
// Page mode (mobile only, see the dedicated section near the bottom of this file): which physical
// half of the CURRENT spread is shown full-frame instead of both halves side by side. Only
// meaningful when both `leftPageId`/`rightPageId` are populated (a real spread/TOC) — declared
// here (not down with the rest of the page-mode logic) since the `focusPageId` watch below needs
// to set it immediately.
const isMobileViewport = useMobileViewport()
// Manual override — the toolbar toggle button (`.questionnaire-book__view-toggle`) below flips
// this, letting a mobile visitor opt back into the desktop-style "whole spread at once" layout
// (and back) instead of always getting page mode just because the viewport is narrow.
const spreadViewForced = ref(false)
const pageModeEnabled = computed(() => isMobileViewport.value && !spreadViewForced.value)
function toggleViewFormat(): void {
  spreadViewForced.value = !spreadViewForced.value
}
watch(spreadViewForced, (forced) => emit('update:spread-view', forced), { immediate: true })
const activeHalfSide = ref<'left' | 'right'>('left')

const viewingPageId = ref<string | null>(props.pages[0]?.id ?? null)
const initialSides = sidesFor(props.pages[0])
const leftPageId = ref<string | null>(initialSides.left)
const rightPageId = ref<string | null>(initialSides.right)
const turning = ref(false)
const turnDirection = ref<'next' | 'prev' | null>(null)
const turnAngle = ref(0)
// The flap's two faces show two DIFFERENT pages: front = outgoing (what the near half was just
// showing, so the leaf looks continuous with the page it's lifting off of), back = target (what the
// far half will become once the leaf lands there).
const flapPageId = ref<string | null>(null)
const flapTargetPageId = ref<string | null>(null)
let timers: ReturnType<typeof setTimeout>[] = []

watch(
  () => props.focusPageId,
  (pageId) => {
    if (pageId && pageId !== viewingPageId.value) {
      viewingPageId.value = pageId
      const sides = sidesFor(props.pages.find((p) => p.id === pageId))
      leftPageId.value = sides.left
      rightPageId.value = sides.right
      activeHalfSide.value = sides.left ? 'left' : 'right'
    }
  },
  { immediate: true },
)

const viewingIndex = computed(() => props.pages.findIndex((page) => page.id === viewingPageId.value))
const viewingFill = computed(() =>
  viewingPageId.value ? props.fillByPageId.get(viewingPageId.value) ?? null : null,
)

function isSpreadPage(pageId: string | null): boolean {
  const slotType = props.pages.find((page) => page.id === pageId)?.slotType
  return slotType === 'SPREAD' || slotType === 'TOC'
}

// A SPREAD (or TOC — same spread-width canvas, see journal-structure.util.ts's
// buildJournalPageSnapshot) canvas is one continuous image spanning both physical pages —
// showing just one half means clipping a 200%-wide inner render shifted left/right (what gives
// the real book look, a visible spine between two actual page-halves, without needing two
// different data sources). A single COVER/BACK_COVER canvas IS one physical page already, so it
// fills its half-slot at its own natural 100% width — windowing it with the 200% trick would
// wrongly crop it in half.
function windowFor(pageId: string | null, side: 'left' | 'right'): { left: string; width: string } {
  if (!isSpreadPage(pageId)) {
    return { left: '0%', width: '100%' }
  }
  return side === 'left' ? { left: '0%', width: '200%' } : { left: '-100%', width: '200%' }
}

interface RenderedHalf {
  key: 'left' | 'right'
  pageId: string
  left: string
  width: string
  windowLeft: string
  windowWidth: string
  canvasData: CanvasData | null
}

// Page mode (see the dedicated section near the bottom of the file): whether a real spread/TOC
// (both sides populated) is currently eligible for the enlarged, per-half-centered zoom AND has a
// same-canvas OTHER half to swipe/pan toward — used only to drive that separate transform layer,
// NOT the frame's own size/ratio below. The frame itself stays at its normal spread size throughout
// (including mid-flip) specifically so paging through it never involves a visible shrink/regrow —
// see `pageModeLayerStyle`'s own comment. `pageModeVisualActive` right below is the broader
// version (also true for a lone cover, which gets the SAME enlarging transform, just centered in
// place with no pan — see `pageModeAnchorX`) — this one narrower flag is still needed separately
// for anything that specifically means "…and there's another half of THIS spread to go to" (the
// swipe's own same-spread-vs-edge branch, `flip`'s half-aware early return).
const pageModeBothSidesActive = computed(
  () => pageModeEnabled.value && !turning.value && Boolean(leftPageId.value) && Boolean(rightPageId.value),
)
// Broader than the above — also true for a lone cover (COVER/BACK_COVER), which gets page mode's
// same enlarging transform (see `pageModeLayerStyle`) despite having no second half to pan toward;
// `pageModeAnchorX` returns 0 (no pan) whenever `pageModeBothSidesActive` is false, so the cover
// just scales up in place around its own (already re-centered — see `coverCenteredOnMobile`) box.
const pageModeVisualActive = computed(
  () => pageModeEnabled.value && !turning.value && Boolean(leftPageId.value || rightPageId.value),
)

// Only while at rest on a lone cover does the frame itself shrink to page width — mid-flip it stays
// full spread width throughout (avoids having to animate the frame's own size in sync with the
// flap's rotation, which `turning` sidesteps entirely: it snaps to full width the instant a flip
// starts, and only shrinks back afterwards if the flip actually landed on another lone cover).
//
// This half-width layout is DELIBERATELY kept exactly as-is even for a mobile-page-mode cover
// (unlike an earlier version of this code, which instead widened the FRAME itself to 100 units
// there): PAGE_ASPECT_RATIO is exactly half of SPREAD_ASPECT_RATIO, so at this same half-width the
// cover's own computed HEIGHT already lands on exactly the same value a full-width spread's own
// height would — the reason the size doesn't visibly jump when `turning` (below) forces the frame
// back to full spread width/ratio for the flap to animate in. Widening the layout box itself to
// look "full size" broke exactly that equality (a taller/narrower box needs MORE height at 100
// units than a spread does at its own 100 units), which is what made the turn visibly shrink the
// book — see `pageModeScale`'s own doc comment for how "looks big" is achieved instead, purely as
// a transform on top of this SAME, unchanged layout box.
const isSingleSlotAtRest = computed(() => !turning.value && Boolean(leftPageId.value) !== Boolean(rightPageId.value))
// On mobile page mode specifically, a lone cover is still centered rather than hugging an edge at
// half width — this alone (no width change) is enough to match the "reads as centered, not off to
// one side" ask without touching the layout math above. Desktop (and any other page —
// QuestionnairePage/JournalReviewPage/MissingPhotosModal) keeps the original edge-hugging "real
// book" look unchanged.
const coverCenteredOnMobile = computed(() => pageModeEnabled.value && isSingleSlotAtRest.value)
const singleSlotSide = computed<'left' | 'right' | null>(() => {
  if (!isSingleSlotAtRest.value || coverCenteredOnMobile.value) {
    return null
  }
  return leftPageId.value ? 'left' : 'right'
})

const frameStyle = computed(() => {
  const ratio = String(isSingleSlotAtRest.value ? PAGE_ASPECT_RATIO : SPREAD_ASPECT_RATIO)
  const margins = {
    marginLeft: singleSlotSide.value === 'right' ? 'auto' : undefined,
    marginRight: singleSlotSide.value === 'left' ? 'auto' : undefined,
  }

  // A definite `width: 50%/100%` plus `height: auto; max-height: 100%` (tried first) looks like the
  // same well-supported `img { width: 100%; height: auto; max-height: Xpx }` pattern, but it isn't:
  // that pattern's "clamped height claws back the width too" behavior is a REPLACED-element sizing
  // rule (img, video…), which only kicks in when BOTH width and height are `auto` together. Here
  // width is a definite percentage, not auto, so once something outside (e.g. the toolbar row below
  // the frame, sharing this same fixed-height column) shrinks the available height enough to hit
  // max-height, the browser clamps height alone and leaves width untouched — the rendered box's
  // actual ratio drifts away from `ratio`, and JournalSpreadThumbnail's own contain-fit (correctly
  // fitting the real page into whatever box it's actually handed) then letterboxes that mismatch as
  // a visible gap down the sides. `width: auto` on both axes at once was tried instead of this and
  // made the frame disappear entirely (see below), so neither plain form actually works.
  //
  // Container query length units sidestep the whole ambiguity by computing the correct axis
  // ourselves instead of leaning on the browser to recover it after the fact: `container-type:
  // size` on `.questionnaire-book__perspective` (below) turns IT into the coordinate space for
  // `cqw`/`cqh` (100cqw/100cqh = that box's own full width/height in px, regardless of what's
  // squeezing it), so `min(Wcqw, calc(100cqh * ratio))` picks whichever of "full available width"
  // or "the width that full available height allows at this ratio" is smaller — the textbook
  // `object-fit: contain` formula, evaluated up front rather than clamped after the fact. `aspect-
  // ratio: ratio` then derives height from that already-correct width with nothing left to drift.
  // The lone-cover case reuses the exact same formula, just scaled by half: PAGE_ASPECT_RATIO is
  // already half of SPREAD_ASPECT_RATIO, so mirroring the halving on the cqw side too (`50cqw`
  // instead of `100cqw`) keeps a lone cover sized as "half of what the full spread would be here",
  // avoiding a visual jump in book size when toggling between a spread and an adjacent lone cover.
  if (props.fitHeight) {
    const widthUnits = isSingleSlotAtRest.value ? 50 : 100
    return {
      width: `min(${widthUnits}cqw, calc(100cqh * ${ratio}))`,
      aspectRatio: ratio,
      ...margins,
    }
  }

  return { width: isSingleSlotAtRest.value ? '50%' : '100%', aspectRatio: ratio, ...margins }
})

// A null side (nothing left of a COVER, nothing right of a BACK_COVER) simply isn't rendered — the
// frame's own background shows through, reading as "outside the book" rather than a page. While at
// rest the frame itself has already shrunk to page width (see `frameStyle`), so the lone populated
// side fills it edge to edge instead of sitting in just its usual half.
const renderedHalves = computed<RenderedHalf[]>(() => {
  const halves: RenderedHalf[] = []
  const fullWidth = isSingleSlotAtRest.value
  if (leftPageId.value) {
    const w = windowFor(leftPageId.value, 'left')
    halves.push({
      key: 'left',
      pageId: leftPageId.value,
      left: '0%',
      width: fullWidth ? '100%' : '50%',
      windowLeft: w.left,
      windowWidth: w.width,
      canvasData: props.canvasDataByPageId.get(leftPageId.value) ?? null,
    })
  }
  if (rightPageId.value) {
    const w = windowFor(rightPageId.value, 'right')
    halves.push({
      key: 'right',
      pageId: rightPageId.value,
      left: fullWidth ? '0%' : '50%',
      width: fullWidth ? '100%' : '50%',
      windowLeft: w.left,
      windowWidth: w.width,
      canvasData: props.canvasDataByPageId.get(rightPageId.value) ?? null,
    })
  }
  return halves
})

const flapFrontCanvasData = computed(() =>
  flapPageId.value ? props.canvasDataByPageId.get(flapPageId.value) ?? null : null,
)
const flapBackCanvasData = computed(() =>
  flapTargetPageId.value ? props.canvasDataByPageId.get(flapTargetPageId.value) ?? null : null,
)

// Always a half-width leaf hinged at the spine — a cover now occupies exactly one half-slot just
// like a spread's own half does, so there's no separate full-width/"decorative" case any more.
const flapGeometry = computed<{ left: string; width: string; origin: string } | null>(() => {
  const direction = turnDirection.value
  if (!direction) {
    return null
  }
  if (direction === 'next') {
    return { left: '50%', width: '50%', origin: 'left center' }
  }
  return { left: '0%', width: '50%', origin: 'right center' }
})

// The flap starts flush over the near half (still showing the outgoing page — see `flip()`) and
// ends flush over the far half (about to become the target once the leaf lands), so each face is
// windowed for whichever page/side it's flush against, for a seamless handoff at both ends.
const flapFrontWindow = computed<{ left: string; width: string } | null>(() => {
  const direction = turnDirection.value
  if (!direction) {
    return null
  }
  return windowFor(flapPageId.value, direction === 'next' ? 'right' : 'left')
})
const flapBackWindow = computed<{ left: string; width: string } | null>(() => {
  const direction = turnDirection.value
  if (!direction) {
    return null
  }
  return windowFor(flapTargetPageId.value, direction === 'next' ? 'left' : 'right')
})

// Mirrors JournalStructurePanel.vue's own numbering: only SPREAD slots get a running count,
// COVER/BACK_COVER get their fixed label instead.
const viewingLabel = computed(() => {
  const page = props.pages[viewingIndex.value]
  if (!page) {
    return ''
  }
  let spreadIndex = 0
  for (const p of props.pages) {
    if (p.slotType === 'SPREAD') {
      spreadIndex += 1
    }
    if (p.id === page.id) {
      break
    }
  }
  return getJournalPageDisplayName(page, spreadIndex)
})

// See the `update:viewing` emit's own doc comment — mirrors the built-in nav's own state for a
// `hideNav` caller building an external one. `immediate` so it arrives on mount too, not just on
// the first actual page change.
watch(
  [viewingIndex, viewingLabel],
  ([index, label]) => {
    emit('update:viewing', { index, total: props.pages.length, label })
  },
  { immediate: true },
)

const spreadManagerOpen = ref(false)

/** In page mode (see `pageModeBothSidesActive`), a real spread/TOC's two halves are only shown one at
 * a time — the FIRST next/prev (from an arrow, or a committed swipe — see the page-mode section
 * near the bottom) just reveals the OTHER half of the SAME canvas: a plain `activeHalfSide` flip,
 * no `JournalPage` change, no 3D turn. Only once already at that spread's own edge does this fall
 * through to a real page turn below — shared by both the built-in arrows AND swipe, so they can
 * never disagree about where "the other half" is. */
function flip(direction: 'next' | 'prev'): void {
  if (turning.value) {
    return
  }

  if (pageModeEnabled.value && leftPageId.value && rightPageId.value) {
    if (direction === 'next' && activeHalfSide.value === 'left') {
      activeHalfSide.value = 'right'
      return
    }
    if (direction === 'prev' && activeHalfSide.value === 'right') {
      activeHalfSide.value = 'left'
      return
    }
  }

  const targetIndex = viewingIndex.value + (direction === 'next' ? 1 : -1)
  if (targetIndex < 0 || targetIndex >= props.pages.length) {
    return
  }

  const currentPage = props.pages[viewingIndex.value]
  const targetPage = props.pages[targetIndex]
  const targetSides = sidesFor(targetPage)

  // Freezes whatever page-mode transform was active right before the turn (see
  // `pageModeFrozenStyle`'s own doc comment) — captured HERE, before `leftPageId`/`rightPageId`
  // start changing below, so it reflects the correct pre-turn state regardless of what they
  // transiently do mid-turn (e.g. one side briefly going null crossing into/out of a lone cover).
  pageModeFrozenStyle.value = pageModeVisualActive.value
    ? { transform: `translate(${pageModeX.value}px, 0) scale(${currentPageModeScale()})` }
    : undefined
  pageModeFrozenCentered.value = pageModeVisualActive.value
  pageModeFrozenScale.value = pageModeVisualActive.value ? currentPageModeScale() : 1

  turning.value = true
  turnDirection.value = direction
  turnAngle.value = 0
  flapPageId.value = currentPage.id
  flapTargetPageId.value = targetPage.id

  timers.push(
    setTimeout(() => {
      turnAngle.value = direction === 'next' ? -180 : 180
      // The near half only swaps the instant the leaf actually starts lifting off it — not at
      // click time — so the outgoing page stays visible under the leaf for that first beat. It may
      // become empty (e.g. the right side going blank as the last spread turns to the back cover).
      if (direction === 'next') {
        rightPageId.value = targetSides.right
      } else {
        leftPageId.value = targetSides.left
      }
    }, 20),
  )
  timers.push(
    setTimeout(() => {
      if (direction === 'next') {
        leftPageId.value = targetSides.left
      } else {
        rightPageId.value = targetSides.right
      }
      viewingPageId.value = targetPage.id
      turning.value = false
      turnAngle.value = 0
      // Entry side for the landed page's own page-mode half (see `flip`'s own doc comment): arriving
      // via 'next' lands reading-order-first (left); via 'prev' lands at the tail end (right) — a
      // lone cover (only one side populated) just uses whichever side that is, regardless.
      if (targetSides.left && targetSides.right) {
        activeHalfSide.value = direction === 'next' ? 'left' : 'right'
      } else {
        activeHalfSide.value = targetSides.left ? 'left' : 'right'
      }
    }, 620),
  )
}

const snackbar = reactive({ show: false, text: '', color: 'success' as 'success' | 'error' })

function notify(text: string, color: 'success' | 'error' = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

// Own local dialog state for the frame's own "Сменить шаблон" button (the CURRENTLY-viewed page
// only) — no queue needed here any more: adding spreads (which used to queue a template pick for
// each of the 2 new ones) now lives entirely in SpreadManagerDialog.vue, which owns its own
// separate instance of this same picker for that — see its own doc comment on why each consumer
// manages its own independent state instead of sharing one.
const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
}>({ open: false, page: null })

function openTemplatePicker(): void {
  const page = props.pages.find((item) => item.id === viewingPageId.value) ?? null
  if (!page) {
    return
  }
  templatePicker.page = page
  templatePicker.open = true
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    notify('Шаблон применён')
    closeTemplatePicker()
  } catch {
    notify(store.orderError ?? 'Не удалось применить шаблон', 'error')
  }
}

// ---------------------------------------------------------------------------
// Pinch-to-zoom / double-tap (only wired up when `zoomEnabled` — see its own doc comment)
// ---------------------------------------------------------------------------

const perspectiveRef = ref<HTMLDivElement | null>(null)
// Pointer capture (see `handleZoomPointerDown`/`handleZoomPointerMove` below) has to be set on
// THIS element specifically, not `perspectiveRef` — capturing on an ancestor retargets all
// subsequent pointer events to THAT ancestor, and since events only bubble upward from wherever
// they're targeted, they'd stop reaching this element's own `@pointermove`/`@pointerup` listeners
// the instant capture kicked in (i.e. pinch/pan would silently die on literally the first move).
const zoomLayerRef = ref<HTMLDivElement | null>(null)
const zoomScale = ref(1)
const zoomX = ref(0)
const zoomY = ref(0)
// True only while a pinch/pan is actively being tracked — suppresses the CSS transition (see
// `.questionnaire-book__zoom-layer`) so the transform tracks the finger(s) with zero lag; a
// double-tap or the release-time snap-back instead WANTS that transition, for a smooth animation.
const zoomGestureActive = ref(false)

const ZOOM_MIN = 1
const ZOOM_MAX = 3
// Below this many px of total pointer movement, a single-finger touch still reads as a tap (so
// JournalSpreadThumbnail's own tap-to-reveal-crop-buttons keeps working normally) rather than a pan.
const ZOOM_PAN_THRESHOLD = 6
// Two releases this close together in time/space count as a double-tap rather than two taps.
const ZOOM_DOUBLE_TAP_MS = 300
const ZOOM_DOUBLE_TAP_PX = 24

// No `transform` at all at rest (not even a harmless-looking identity one) — ANY non-`none`
// transform value promotes this to its own compositing layer, and Safari has a known rendering
// bug where a *child* with `filter: drop-shadow` (`.questionnaire-book__frame`, always present)
// sitting inside a transformed/layer-promoted ancestor renders grayed-out — reproducible even
// while sitting fully at rest (scale 1, no pan), since the bug is triggered by the layer itself
// existing, not by anything actually animating. Only creating the transform once zoom is genuinely
// non-default sidesteps it entirely for every visitor who never actually zooms in.
const zoomLayerStyle = computed(() => {
  if (zoomScale.value === 1 && zoomX.value === 0 && zoomY.value === 0) {
    return undefined
  }
  return {
    transform: `translate(${zoomX.value}px, ${zoomY.value}px) scale(${zoomScale.value})`,
  }
})

const activeZoomPointers = new Map<number, { x: number; y: number }>()
let pinchStartDistance = 0
let pinchStartScale = 1
// The pinch's own midpoint at gesture start, and the pan offset at that same moment — tracked
// alongside the distance-based scale above so a single two-finger gesture can zoom AND pan at
// once (moving both fingers together, not just spreading/pinching them), the same as any other
// photo viewer's pinch gesture.
let pinchStartMid: { x: number; y: number } | null = null
let pinchStartPan: { x: number; y: number } | null = null
let panOrigin: { x: number; y: number; startX: number; startY: number } | null = null
let zoomGestureMoved = false
let lastTapAt = 0
let lastTapPos = { x: 0, y: 0 }
// Set right before a gesture's own `pointerup` completes when that gesture shouldn't also act as
// a tap on whatever photo/text happens to be underneath — a real pinch/pan drag, or specifically
// the SECOND tap of a recognized double-tap (the first tap's own click still goes through
// normally, same as any other single tap elsewhere — only the second one, which would otherwise
// re-toggle whatever the first one just opened, gets suppressed here). Consumed by
// `handleZoomClickCapture` below, on the capture phase so it runs before the click ever reaches
// JournalSpreadThumbnail's own tap-to-reveal-crop-buttons handler.
let suppressNextClick = false

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function handleZoomClickCapture(event: MouseEvent): void {
  if (!suppressNextClick) {
    return
  }
  suppressNextClick = false

  // Real fingers almost never land perfectly still — a few px of incidental movement on an
  // otherwise ordinary tap routinely crosses `ZOOM_PAN_THRESHOLD` above, marking it "moved" and
  // landing here even with no deliberate pinch/pan at all. Only actually suppressing when the
  // click would land ON a photo (the one case that matters — see the original request this was
  // added for) keeps that fix working without also swallowing every OTHER click that happens to
  // pass through here — `stopPropagation` on the capture phase kills an event's entire remaining
  // journey in one go, target's own handler AND every ancestor's bubble-phase listener alike, so
  // calling it unconditionally here was also blocking JournalSpreadThumbnail's own "tap outside an
  // active element closes its crop/replace buttons" document-level listener from ever seeing an
  // ordinary tap that landed anywhere else — reading as those buttons appearing/staying open on
  // their own, including on taps nowhere near a photo.
  const target = event.target as HTMLElement | null
  if (!target?.closest('.spread-thumb__el')) {
    return
  }
  event.stopPropagation()
  event.preventDefault()
}

function pointerMidpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Keeps the visibly zoomed content within the frame's own box on every axis — panning (or a
 * pinch's own drift) can never drag the book out past its edges into the surrounding page. */
function clampZoomPan(x: number, y: number, scale: number): { x: number; y: number } {
  const el = perspectiveRef.value
  if (!el) {
    return { x: 0, y: 0 }
  }
  const maxX = (el.clientWidth * (scale - 1)) / 2
  const maxY = (el.clientHeight * (scale - 1)) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  }
}

function resetZoom(): void {
  zoomScale.value = 1
  zoomX.value = 0
  zoomY.value = 0
}

function applyDoubleTapZoom(event: PointerEvent): void {
  if (zoomScale.value > 1) {
    resetZoom()
    return
  }

  zoomScale.value = 2
  const el = perspectiveRef.value
  if (!el) {
    return
  }
  // Zooms in centered on wherever the user actually double-tapped, not just the frame's middle.
  const rect = el.getBoundingClientRect()
  const offsetX = event.clientX - (rect.left + rect.width / 2)
  const offsetY = event.clientY - (rect.top + rect.height / 2)
  const clamped = clampZoomPan(-offsetX, -offsetY, 2)
  zoomX.value = clamped.x
  zoomY.value = clamped.y
}

function handleZoomPointerDown(event: PointerEvent): void {
  activeZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  zoomGestureMoved = false
  // Clears any leftover suppression from a PREVIOUS gesture that never actually got a click to
  // consume it (a real drag/pinch often doesn't produce one at all — browsers already suppress
  // the synthetic click themselves once movement is significant) — without this, that stale flag
  // could wrongly swallow this NEXT, unrelated tap's own click instead.
  suppressNextClick = false

  if (activeZoomPointers.size === 2) {
    // A second finger just landed — this is unambiguously a pinch, not a tap, so it's safe to
    // capture both pointers now (capturing on every pointerdown unconditionally would also
    // retarget a plain tap's eventual click event to this wrapper instead of the photo/button the
    // user actually tapped — see `handleZoomPointerMove`'s own note for the single-finger case).
    // Capturing the FIRST finger's id happens here, from the SECOND finger's own pointerdown, not
    // from that first pointer's own event — some engines throw for that (`InvalidPointerId`-style
    // rejections vary), so each capture is wrapped individually: a failed capture there would
    // otherwise abort this whole function before `pinchStartDistance` etc. below ever get set,
    // silently breaking the pinch itself (a plain tap/pan doesn't hit this branch, so wouldn't
    // have surfaced the same way).
    for (const id of activeZoomPointers.keys()) {
      try {
        zoomLayerRef.value?.setPointerCapture(id)
      } catch {
        // Not fatal — the gesture still works via normal event bubbling as long as the finger
        // stays over this element, which `touch-action: none` already encourages.
      }
    }
    const [a, b] = [...activeZoomPointers.values()]
    pinchStartDistance = pointerDistance(a, b)
    pinchStartScale = zoomScale.value
    pinchStartMid = pointerMidpoint(a, b)
    pinchStartPan = { x: zoomX.value, y: zoomY.value }
    panOrigin = null
    zoomGestureActive.value = true
  } else if (activeZoomPointers.size === 1 && zoomScale.value > 1) {
    panOrigin = { x: event.clientX, y: event.clientY, startX: zoomX.value, startY: zoomY.value }
  }
}

function handleZoomPointerMove(event: PointerEvent): void {
  if (!activeZoomPointers.has(event.pointerId)) {
    return
  }
  activeZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activeZoomPointers.size === 2 && pinchStartDistance > 0 && pinchStartMid && pinchStartPan) {
    const [a, b] = [...activeZoomPointers.values()]
    const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartScale * (pointerDistance(a, b) / pinchStartDistance)))
    zoomScale.value = scale
    // The fingers' midpoint moving (not just their distance apart changing) pans the content —
    // spreading/pinching zooms, dragging both fingers together looks around, same gesture either
    // combined or in sequence.
    const mid = pointerMidpoint(a, b)
    const clamped = clampZoomPan(
      pinchStartPan.x + (mid.x - pinchStartMid.x),
      pinchStartPan.y + (mid.y - pinchStartMid.y),
      scale,
    )
    zoomX.value = clamped.x
    zoomY.value = clamped.y
    zoomGestureMoved = true
    suppressNextClick = true
    event.preventDefault()
    return
  }

  if (activeZoomPointers.size === 1 && panOrigin) {
    const dx = event.clientX - panOrigin.x
    const dy = event.clientY - panOrigin.y
    if (!zoomGestureMoved && Math.hypot(dx, dy) < ZOOM_PAN_THRESHOLD) {
      return
    }
    if (!zoomGestureMoved) {
      // Only starts capturing once real panning is confirmed (past the threshold above) — a plain
      // tap never captures, so its click still reaches the actual element underneath normally.
      try {
        zoomLayerRef.value?.setPointerCapture(event.pointerId)
      } catch {
        // Not fatal — see the pinch branch's own note above.
      }
      zoomGestureActive.value = true
    }
    zoomGestureMoved = true
    suppressNextClick = true
    const clamped = clampZoomPan(panOrigin.startX + dx, panOrigin.startY + dy, zoomScale.value)
    zoomX.value = clamped.x
    zoomY.value = clamped.y
    event.preventDefault()
  }
}

function finishZoomPointer(event: PointerEvent): void {
  activeZoomPointers.delete(event.pointerId)
  if (activeZoomPointers.size < 2) {
    pinchStartDistance = 0
    pinchStartMid = null
    pinchStartPan = null
  }

  if (activeZoomPointers.size === 1 && zoomScale.value > 1) {
    // One finger of a pinch just lifted — the remaining one keeps panning without a break
    // (otherwise the user would have to fully release and re-touch to keep looking around).
    const [remaining] = activeZoomPointers.values()
    panOrigin = { x: remaining.x, y: remaining.y, startX: zoomX.value, startY: zoomY.value }
    return
  }

  if (activeZoomPointers.size === 0) {
    panOrigin = null
    zoomGestureActive.value = false
    if (zoomScale.value <= ZOOM_MIN) {
      resetZoom()
    }
  }
}

function handleZoomPointerUp(event: PointerEvent): void {
  const wasTap = !zoomGestureMoved && activeZoomPointers.size === 1
  finishZoomPointer(event)

  if (!wasTap) {
    return
  }
  const now = Date.now()
  const isDoubleTap =
    now - lastTapAt < ZOOM_DOUBLE_TAP_MS &&
    pointerDistance(lastTapPos, { x: event.clientX, y: event.clientY }) < ZOOM_DOUBLE_TAP_PX
  if (isDoubleTap) {
    suppressNextClick = true
    applyDoubleTapZoom(event)
    lastTapAt = 0
  } else {
    lastTapAt = now
    lastTapPos = { x: event.clientX, y: event.clientY }
  }
}

function handleZoomPointerCancel(event: PointerEvent): void {
  finishZoomPointer(event)
}

// A trackpad pinch (no real touchscreen involved — this is how it shows up when testing in Chrome
// DevTools' device-emulation mode with a laptop trackpad, and how real desktop/laptop visitors
// would zoom too) never fires a second `pointerdown` at all — OS-level gesture recognition turns
// it into a synthetic `wheel` event with `ctrlKey: true` instead (the same event a literal
// Ctrl+scroll produces), entirely separate from the touch-driven pinch above. Left unhandled, that
// event's default action is the BROWSER's own page zoom — precisely the "whole window zooms"
// symptom this exists to prevent for trackpad users specifically.
const WHEEL_ZOOM_SENSITIVITY = 0.01

function handleZoomWheel(event: WheelEvent): void {
  if (!event.ctrlKey) {
    // A plain (non-pinch) wheel/trackpad scroll — leave it alone; only a pinch (or literal
    // Ctrl+scroll) synthesizes ctrlKey here, and only that should be treated as a zoom gesture.
    return
  }
  event.preventDefault()

  const prevScale = zoomScale.value
  const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevScale - event.deltaY * WHEEL_ZOOM_SENSITIVITY * prevScale))
  zoomScale.value = nextScale

  const el = perspectiveRef.value
  if (el && nextScale !== prevScale) {
    // Keeps whatever content point is currently under the cursor visually fixed under it as the
    // scale changes, rather than always zooming toward the frame's own center — same "zoom toward
    // the pointer" behavior as Figma/Google Maps/etc. `ratio` is how much the scale just changed
    // by; deriving the new pan from it (rather than leaving the old pan untouched) is what makes
    // the zoom track the cursor instead of drifting back toward center on every tick.
    const rect = el.getBoundingClientRect()
    const offsetX = event.clientX - (rect.left + rect.width / 2)
    const offsetY = event.clientY - (rect.top + rect.height / 2)
    const ratio = nextScale / prevScale
    const clamped = clampZoomPan(
      offsetX * (1 - ratio) + zoomX.value * ratio,
      offsetY * (1 - ratio) + zoomY.value * ratio,
      nextScale,
    )
    zoomX.value = clamped.x
    zoomY.value = clamped.y
  }

  if (nextScale <= ZOOM_MIN) {
    resetZoom()
  }
}

// A flip changes which page/spread is on screen — starting the new one zoomed in (at whatever pan
// offset applied to the OLD one) would be disorienting, so every navigation resets to the default.
watch(viewingPageId, () => {
  if (props.zoomEnabled) {
    resetZoom()
  }
})

// ---------------------------------------------------------------------------
// Page mode (mobile only — see `pageModeVisualActive`): a real spread/TOC is shown ENLARGED,
// auto-centered on whichever half is "active" (`activeHalfSide`), so it reads as a big single page
// with a bit of the OTHER half peeking in at the edge — not a smaller, separately-cropped render
// (that both looked and behaved like a size change while flipping, which is exactly what this
// replaced). A lone cover (COVER/BACK_COVER) gets the SAME enlarging transform, just with no pan
// (already centered by its own layout — see `coverCenteredOnMobile`), since it has no second half
// to point toward. The frame itself (`frameStyle`/`renderedHalves`) is completely untouched by
// page mode — same spread, same size, same both-halves-side-by-side layout as ever (and a lone
// cover keeps its own original half-width layout too, deliberately — see `isSingleSlotAtRest`'s own
// comment on why its height already matches a spread's); this is purely an extra transform layer
// (`.questionnaire-book__page-mode-layer`, wrapping the existing pinch-zoom layer — see the
// template) that enlarges and pans it, exactly like the user's own pinch-zoom already does, just
// automatic/anchored per half (or centered, for a cover) instead of gesture-driven. A swipe pans
// this same layer between "centered on left" and "centered on right" within a spread; at the
// spread's own edge — or from a lone cover, which has no "own edge" to be anywhere but at — it
// instead hands off to the existing `flip()` 3D turn (see its own doc comment on being half-aware) — and
// since this layer's scale/pan never resets around that call, the turn plays out at the SAME
// enlarged size throughout, with no visible shrink/regrow. Independent of `zoomEnabled` — page mode
// is needed even where pinch-to-zoom is off (QuestionnairePage.vue/MissingPhotosModal.vue) — so
// these handlers are wired up unconditionally, on their OWN separate layer from `handleZoom*`
// above, which stays completely unaware page mode exists (its own `zoomScale`/`zoomX`/`zoomY`
// keep meaning exactly what they always did, just relative to an already-enlarged view).
// ---------------------------------------------------------------------------

// Upper bound only — tuned by eye as "big enough that the active half clearly dominates the
// frame, small enough that a real sliver of the other half still shows at the edge" (the actual
// point of this whole mode), but the REAL scale used (see `currentPageModeScale`) is capped to
// whatever the frame's own available vertical space allows. Uniform (same X/Y factor) is required
// — a non-uniform scale (scaleX only) was tried first specifically to dodge that vertical-space
// limit, but it stretches every photo/line of text in the page out of its own proportions, which
// reads as far more obviously "wrong" than just not enlarging quite as much would.
const PAGE_MODE_ZOOM_SCALE_MAX = 1.8
const PAGE_SWIPE_TAP_THRESHOLD = 6
// Only applied to the current half's own rubber-band drag right at the spread's own edge (nothing
// further within it to pan to) — a fraction of the raw finger movement, so it reads as "resisting"
// rather than tracking 1:1 like the within-spread pan does.
const PAGE_SWIPE_EDGE_RESISTANCE = 0.35
const PAGE_SWIPE_DISTANCE_FRACTION = 0.25
const PAGE_SWIPE_VELOCITY_THRESHOLD = 0.5

const pageModeLayerRef = ref<HTMLDivElement | null>(null)
const frameRef = ref<HTMLDivElement | null>(null)
const pageModeX = ref(0)
const swipeGestureActive = ref(false)
// Snapshot of the page-mode transform taken the instant a real turn (`flip`'s own non-early-return
// path) begins — `pageModeLayerStyle` uses this, frozen, for the whole turn instead of its normal
// reactive computation, since `leftPageId`/`rightPageId` (and so `pageModeBothSidesActive`) pass
// through transient states mid-turn (e.g. one side briefly null crossing into/out of a lone cover)
// that would otherwise make the transform flicker off and the book visibly shrink mid-turn.
const pageModeFrozenStyle = ref<{ transform: string } | undefined>(undefined)
// Same freeze, for whether the frame sits vertically centered (`--page-mode-centered`, see the
// template) — without this, the SAME mid-turn `pageModeBothSidesActive` flip that used to blank
// the scale also flips this back to the frame's plain mobile flex-end alignment, so the book jumps
// downward mid-turn (its centering point moving) even once the scale itself no longer resets.
const pageModeFrozenCentered = ref(false)
const pageModeCentered = computed(() => (turning.value ? pageModeFrozenCentered.value : pageModeVisualActive.value))
// Same freeze, for the plain NUMBER (not the transform string) — used to counter-scale UI chrome
// that sits inside the enlarged frame (the "Сменить шаблон" button below) back down to its normal
// size, since it's a descendant of the transformed layer and would otherwise visually grow right
// along with the book itself.
const pageModeFrozenScale = ref(1)
const pageModeButtonScale = computed(() => {
  const scale = turning.value ? pageModeFrozenScale.value : pageModeVisualActive.value ? currentPageModeScale() : 1
  return scale > 1 ? 1 / scale : 1
})

/** The largest UNIFORM scale that still leaves the frame's full height inside the available
 * vertical space (`pageModeLayerRef`'s own, unscaled) — usually well under `PAGE_MODE_ZOOM_SCALE_MAX`
 * is already achievable given how much taller a portrait phone viewport is than a landscape spread,
 * but this never lets the enlarged frame's height exceed what's actually there, whatever that is. */
let lastLoggedScaleInputs = ''
function currentPageModeScale(): number {
  const container = pageModeLayerRef.value
  const frame = frameRef.value
  if (!container || !frame || frame.clientHeight <= 0) {
    return 1
  }
  const maxFit = container.clientHeight / frame.clientHeight
  const result = Math.max(1, Math.min(PAGE_MODE_ZOOM_SCALE_MAX, maxFit))
  // TEMP DEBUG
  const key = `${container.clientWidth}x${container.clientHeight} / ${frame.clientWidth}x${frame.clientHeight}`
  if (key !== lastLoggedScaleInputs) {
    lastLoggedScaleInputs = key
    console.log(
      `[page-mode-scale] container=${container.clientWidth}x${container.clientHeight} frame=${frame.clientWidth}x${frame.clientHeight} maxFit=${maxFit.toFixed(3)} result=${result.toFixed(3)} fitHeight=${props.fitHeight}`,
    )
  }
  return result
}

/** The pan (`pageModeX`) that centers `side`'s own half of the current spread in the frame — or,
 * for a lone cover (`pageModeBothSidesActive` false), just 0: it's already re-centered by its own
 * layout (see `coverCenteredOnMobile`'s margin removal, not a pan), so the scale in
 * `pageModeLayerStyle` alone enlarges it in place around that same center, no translate needed.
 *
 * For the spread case, CSS composes `transform: translate(tx) scale(S)` as scale-then-translate
 * (`final = local*S + tx`, scale applied first around the transform-origin, translate a flat
 * screen-px shift after) — a local point `p0` (the target half's own center, at ∓¼ of the frame's
 * width from the spread's own center/spine) ends up on screen at `p0*S + tx`; solving that for 0
 * (dead center) gives `tx = -p0*S`. (An EARLIER version of this used `p0*(1-S)` instead, by wrongly
 * pattern-matching `applyDoubleTapZoom`'s own `zoomX = -offsetX` — that one only works out to the
 * same thing at S=2, not in general, and being off by the extra `+p0` term cut off the far edge of
 * whichever half was active instead of centering it.) */
function pageModeAnchorX(side: 'left' | 'right'): number {
  if (!pageModeBothSidesActive.value) {
    return 0
  }
  const frameWidth = pageModeLayerRef.value?.clientWidth || 0
  const localCenter = (frameWidth / 4) * (side === 'left' ? -1 : 1)
  return -localCenter * currentPageModeScale()
}

const pageModeLayerStyle = computed(() => {
  if (turning.value) {
    return pageModeFrozenStyle.value
  }
  if (!pageModeVisualActive.value) {
    return undefined
  }
  return { transform: `translate(${pageModeX.value}px, 0) scale(${currentPageModeScale()})` }
})

let swipePointerId: number | null = null
let swipeStartX = 0
let swipeStartTime = 0
let swipeStartAnchorX = 0
let swipeRawDx = 0
let swipeMoved = false
let swipeDirection: 'next' | 'prev' | null = null

function handlePageSwipePointerDown(event: PointerEvent): void {
  if (swipePointerId !== null) {
    // A second finger just landed mid-swipe — a pinch (or accidental multi-touch), not a swipe;
    // back off entirely instead of silently retargeting to it (handleZoomPointerDown above takes
    // over from here when zoomEnabled).
    swipePointerId = null
    swipeGestureActive.value = false
    pageModeX.value = pageModeAnchorX(activeHalfSide.value)
    return
  }
  // Only starts a page-mode pan when at this layer's own rest scale — once the user has pinched
  // in FURTHER (zoomScale > 1, tracked entirely by the separate, inner zoom layer), a single-finger
  // drag instead pans WITHIN that closer view (handleZoomPointerMove's own zoomScale > 1 branch).
  // `pageModeVisualActive` (not the narrower `pageModeBothSidesActive`) so a swipe CAN start on a
  // lone cover too — it just has nowhere within itself to pan to (see `hasSameSpreadTarget` below),
  // so it always takes the rubber-band-then-flip path.
  if (!pageModeVisualActive.value || zoomScale.value !== 1) {
    return
  }
  // Clears any leftover suppression from a previous gesture that never got a click to consume it —
  // same reasoning as handleZoomPointerDown's own identical line.
  suppressNextClick = false
  swipePointerId = event.pointerId
  swipeStartX = event.clientX
  swipeStartTime = performance.now()
  swipeStartAnchorX = pageModeAnchorX(activeHalfSide.value)
  swipeMoved = false
  swipeRawDx = 0
  swipeDirection = null
}

function handlePageSwipePointerMove(event: PointerEvent): void {
  if (swipePointerId === null || swipePointerId !== event.pointerId) {
    return
  }
  swipeRawDx = event.clientX - swipeStartX
  if (!swipeMoved && Math.abs(swipeRawDx) < PAGE_SWIPE_TAP_THRESHOLD) {
    return
  }
  if (!swipeMoved) {
    swipeMoved = true
    swipeGestureActive.value = true
    suppressNextClick = true
    try {
      pageModeLayerRef.value?.setPointerCapture(event.pointerId)
    } catch {
      // Not fatal — the gesture still works via normal event bubbling as long as the finger stays
      // over this element (the page-mode touch-action: none modifiers below already help with that).
    }
  }
  const direction: 'next' | 'prev' = swipeRawDx < 0 ? 'next' : 'prev'
  swipeDirection = direction
  const hasSameSpreadTarget =
    pageModeBothSidesActive.value &&
    ((direction === 'next' && activeHalfSide.value === 'left') || (direction === 'prev' && activeHalfSide.value === 'right'))
  const dx = hasSameSpreadTarget ? swipeRawDx : swipeRawDx * PAGE_SWIPE_EDGE_RESISTANCE
  pageModeX.value = swipeStartAnchorX + dx
  event.preventDefault()
}

function handlePageSwipePointerUp(event: PointerEvent): void {
  if (swipePointerId === null || swipePointerId !== event.pointerId) {
    return
  }
  swipePointerId = null
  swipeGestureActive.value = false

  if (!swipeMoved || !swipeDirection) {
    pageModeX.value = pageModeAnchorX(activeHalfSide.value)
    return
  }

  const elapsedMs = Math.max(1, performance.now() - swipeStartTime)
  const velocity = Math.abs(swipeRawDx) / elapsedMs
  const frameWidth = perspectiveRef.value?.clientWidth || 1
  const distanceFraction = Math.abs(swipeRawDx) / frameWidth
  const committed = distanceFraction >= PAGE_SWIPE_DISTANCE_FRACTION || velocity >= PAGE_SWIPE_VELOCITY_THRESHOLD

  if (!committed) {
    pageModeX.value = pageModeAnchorX(activeHalfSide.value)
    return
  }

  // `flip` (see its own doc comment) updates `activeHalfSide` SYNCHRONOUSLY when it's just
  // revealing the other half of THIS spread — comparing before/after tells the two cases apart
  // without duplicating that logic here.
  const sideBefore = activeHalfSide.value
  flip(swipeDirection)

  if (activeHalfSide.value !== sideBefore) {
    // Same-spread toggle already landed — pan to the new anchor right away.
    pageModeX.value = pageModeAnchorX(activeHalfSide.value)
  } else {
    // A real page turn is now in flight (`activeHalfSide` only updates once flip's own 620ms turn
    // lands — see its doc comment) — settle the rubber-band back to the pre-drag anchor for now;
    // the `watch` below picks up the eventual `activeHalfSide` change and pans to the NEW spread's
    // entry anchor once it actually happens, so the "camera" never jumps ahead of the content.
    pageModeX.value = pageModeAnchorX(sideBefore)
  }
}

function handlePageSwipePointerCancel(event: PointerEvent): void {
  if (swipePointerId === null || swipePointerId !== event.pointerId) {
    return
  }
  swipePointerId = null
  swipeGestureActive.value = false
  pageModeX.value = pageModeAnchorX(activeHalfSide.value)
}

// Keeps the pan anchored on whatever `flip`/the arrows/the `focusPageId` jump just settled
// `activeHalfSide` on — covers every way it can change, not just the swipe release above (e.g. the
// built-in arrow buttons, or landing on a lone cover, which still gets page mode's enlarging
// transform — just centered/pan-less, see `pageModeAnchorX`). Runs immediately too, but
// `pageModeLayerRef` isn't mounted yet at that point (frameWidth reads 0) — `onMounted` below
// recomputes it once the real size is available.
watch([activeHalfSide, pageModeVisualActive], () => {
  if (!swipeGestureActive.value) {
    pageModeX.value = pageModeAnchorX(activeHalfSide.value)
  }
}, { immediate: true })

// Safari (iOS/macOS) recognizes a two-finger pinch through its OWN proprietary `gesturestart`/
// `gesturechange`/`gestureend` events — a WebKit-only mechanism that predates (and is entirely
// separate from) both Pointer Events and the standard `touch-action` CSS property. `touch-action:
// none` (see `.questionnaire-book__perspective--zoom-enabled`/`--page-mode`) stops the
// pointermove-driven side of things, but on Safari specifically the page can still zoom itself
// through THIS other channel unless it's blocked here too — this is the documented reason a pinch
// can still zoom the whole window instead of just the book despite touch-action being set
// correctly. Other browsers simply never fire these events, so this listener is a harmless no-op
// there. Untyped (`Event`, not a `GestureEvent`) since that type isn't part of the standard DOM
// lib — only `preventDefault()` is actually needed here.
function preventNativeGestureZoom(event: Event): void {
  if (props.zoomEnabled || pageModeEnabled.value) {
    event.preventDefault()
  }
}

onMounted(() => {
  const el = perspectiveRef.value
  el?.addEventListener('gesturestart', preventNativeGestureZoom)
  el?.addEventListener('gesturechange', preventNativeGestureZoom)

  // The `watch([activeHalfSide, pageModeVisualActive], ...)` above already ran once (immediate)
  // before `pageModeLayerRef` existed, so its frameWidth read as 0 — now that it's actually
  // mounted, recompute for real.
  pageModeX.value = pageModeAnchorX(activeHalfSide.value)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers = []
  swipePointerId = null

  const el = perspectiveRef.value
  el?.removeEventListener('gesturestart', preventNativeGestureZoom)
  el?.removeEventListener('gesturechange', preventNativeGestureZoom)
})

// Lets a `hide-nav` caller (see that prop's own doc comment) drive the same page-turn animation
// from its own external prev/next buttons instead of the built-in nav row.
defineExpose({ flip })
</script>

<style scoped lang="scss">
.questionnaire-book {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  width: 100%;

  @include mobile-only {
    gap: $spacing-3;
  }
}

// Height, not width, is the fixed dimension here — the frame's own `aspect-ratio` (set via
// `frameStyle`) then derives its width from whatever height `.questionnaire-book__perspective`
// ends up with, the mirror image of the normal width-driven layout below.
.questionnaire-book--fit-height {
  height: 100%;
  min-height: 0;
}

.questionnaire-book--fit-height .questionnaire-book__perspective {
  flex: 1;
  min-height: 0;
  // Definite (100%), not auto — this box's own width/height need to be fully resolved from ITS
  // ancestors (the flex chain above), independent of the frame inside it, both because a percentage
  // needs a definite containing-block size to resolve against at all, and because `container-type:
  // size` below requires a size that doesn't itself depend on this container's contents.
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  // Makes `cqw`/`cqh` inside the frame (see `frameStyle`) mean "100% of THIS box's own, already-
  // resolved width/height" — the coordinate space the frame's contain-fit formula is computed in.
  container-type: size;
  // NOT where any leftover vertical slack (frame shorter than this box) actually gets
  // redistributed, despite appearances — this box's only flex child, `.questionnaire-book__zoom-
  // layer`, is itself always height:100% (fills this box completely regardless of the frame's own
  // size inside IT), so align-items here has nothing left to do. See that rule's own mobile-only
  // override instead.
}

.questionnaire-book__perspective {
  position: relative;
  width: 100%;
  perspective: 1800px;
}

// Only actually clips while zoomed IN (scale > 1, from a manual pinch) — left alone at rest so it
// never risks clipping `.questionnaire-book__frame`'s own drop-shadow, which is allowed to bleed
// past the frame's own box (see that rule's comment) and would otherwise get cut off here, since
// this box is normally sized to match the frame almost exactly. Page mode's OWN enlargement is
// deliberately NOT clipped here any more — this box is also the containing block for `nav-overlay`
// (PhotoUploadPage.vue's round prev/next arrows, positioned to straddle the frame's own edge on
// purpose), and page mode is active for the entire time a spread is shown on mobile, not just
// during an occasional manual pinch, so clipping it here was clipping those arrows too, constantly.
// See `.questionnaire-book__page-mode-layer--clipped` instead, which only contains the actually-
// enlarged content, not the arrows.
.questionnaire-book__perspective--zoomed {
  overflow: hidden;
}

// touch-action: none up here, not just on `.questionnaire-book__zoom-layer` inside — a two-finger
// pinch's own touch-start points don't both have to land inside that tighter inner box (nav-overlay
// arrows, or just a finger slightly off the frame's own edge, both still sit within this outer
// box), and if EITHER touch point starts somewhere this doesn't cover, the platform can still claim
// the whole gesture as its own page-zoom instead of handing it to `handleZoomPointerDown` — exactly
// the "the whole window zooms instead of just the journal" symptom this exists to prevent. Left off
// entirely where zoom is never offered (QuestionnairePage.vue), same reasoning as that inner rule.
.questionnaire-book__perspective--zoom-enabled {
  touch-action: none;
}

// Same reasoning as the zoom-enabled rule above, for page-mode swipe instead — needed even where
// zoom is off (QuestionnairePage.vue/MissingPhotosModal.vue), since page mode itself is independent
// of `zoomEnabled` (see handlePageSwipePointerDown's own doc comment).
.questionnaire-book__perspective--page-mode {
  touch-action: none;
}

// The OUTER of the two independent transform layers (see the template's own comment) — enlarges
// and pans the whole spread to keep the active half centered in page mode. Same base layout as
// `.questionnaire-book__zoom-layer` below (which it wraps): sized to fill its parent, flex-centers
// it. No mobile flex-end override here (unlike zoom-layer below) — its only child (zoom-layer)
// always has an explicit height:100%, which makes align-items on THIS box a no-op either way; the
// one that actually matters for where the frame ends up is zoom-layer's own, right below.
.questionnaire-book__page-mode-layer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 260ms ease;
}

// touch-action: none only where page mode is actually active — everywhere else this stays inert,
// same reasoning as `.questionnaire-book__zoom-layer--enabled` below.
.questionnaire-book__page-mode-layer--enabled {
  touch-action: none;
}

// No transition while a page-mode swipe is actively being tracked — same reasoning as
// `.questionnaire-book__zoom-layer--gesture` below, the transform needs to track the finger
// immediately, not ease toward a stale target a frame behind.
.questionnaire-book__page-mode-layer--gesture {
  transition: none;
}

// Clips the enlarged frame to THIS box's own edges while page mode's own scale is actually active
// (see `pageModeCentered`, already frozen/stable through a turn — same reasoning applies here so
// this doesn't flicker off mid-turn either). Deliberately on this inner layer, not
// `.questionnaire-book__perspective` (see that rule's own updated comment) — this box only wraps
// the actually-enlarged content, not `nav-overlay`'s prev/next arrows, which sit outside it as
// perspective's own children and are positioned to straddle the frame's own edge on purpose.
.questionnaire-book__page-mode-layer--clipped {
  overflow: hidden;
}

// Wraps the frame so pinch/pan (see `handleZoomPointerDown` and friends) can transform IT without
// touching the frame's own `rotateX` tilt — sized to fill this box's parent (`width`/`height:
// 100%`) so it doesn't change how the frame itself gets sized (percentage height degrades to
// `auto` here when the parent's own height is itself content-derived — the non-fit-height case —
// and resolves to a real 100% when fit-height gives the parent a definite height instead).
.questionnaire-book__zoom-layer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 220ms ease;

  // On mobile fit-height (see the perspective rule below), this box is height:100% of perspective
  // while the frame inside it is often shorter (contain-fit binds on width there, not height) —
  // THIS is the alignment that actually decides where that leftover vertical slack goes (it fills
  // the whole box regardless of the frame's own size, so a plain `align-items` on the perspective
  // rule itself has nothing left to redistribute — this is the one that matters). flex-end collects
  // it above the frame instead of splitting it, so the frame sits flush against the toolbar row
  // below instead of leaving visible space above it, on request. Overridden back to centered
  // whenever page mode's own scale is active — see `--centered` right below.
  @include mobile-only {
    align-items: flex-end;
  }
}

// Page mode's own enlarging transform (on `.questionnaire-book__page-mode-layer`, wrapping this
// box) scales around THIS box's own vertical center — flex-end above would leave the frame sitting
// at the BOTTOM of the leftover vertical slack instead, well below that center, so scaling would
// grow it asymmetrically (as if anchored near its bottom edge, not its middle) rather than evenly
// in both directions. Re-centering here whenever that scale is actually active keeps the two
// aligned, so a page's own leftover vertical room (see `currentPageModeScale`) is what actually
// gets consumed by the enlargement, split evenly above/below, instead of sitting unused above it.
.questionnaire-book__zoom-layer--page-mode-centered {
  @include mobile-only {
    align-items: center;
  }
}

// touch-action: none only where zoom is actually offered — everywhere else this stays inert, so a
// caller that never turns zoom on (QuestionnairePage.vue) keeps the platform's own native touch
// scrolling/pinch behavior over the book unchanged.
.questionnaire-book__zoom-layer--enabled {
  touch-action: none;
}

// No transition while a pinch/pan is actively being tracked — the transform needs to track the
// finger(s) immediately, not ease toward a stale target a frame behind.
.questionnaire-book__zoom-layer--gesture {
  transition: none;
}

.questionnaire-book__frame {
  position: relative;
  width: 100%;
  overflow: hidden;
  transform: rotateX(2deg);
  transform-style: preserve-3d;
  // A drop-shadow (not box-shadow) follows the actual opaque pixels rendered inside — the halves'
  // own white background — rather than this element's own box. While turning, this box briefly
  // spans full spread width even though only one side has a real page in it (the flap needs the
  // room to animate across without being clipped); a plain box-shadow would cast a shadow-tinted
  // rectangle over that empty side too. A drop-shadow only ever hugs whatever's actually there.
  filter: drop-shadow(0 24px 60px rgba(0, 0, 0, 0.14));
}

// Turned off while page mode's own transform is active (see `.questionnaire-book__page-mode-layer`
// in the template) — for two reasons. Visually, the whole point there is the book filling most of
// the screen, where a decorative shadow scaled up right along with it (a CSS filter on a
// transformed element scales with it) reads as an odd, oversized smudge rather than the subtle lift
// it's meant to be at the frame's normal, smaller size. More importantly, it also sidesteps a real
// Safari bug: a `filter: drop-shadow` child sitting inside a transformed ancestor renders GRAYED
// OUT on that browser (see `zoomLayerStyle`'s own doc comment on the exact same bug, which is why
// pinch-zoom's transform only ever gets created once genuinely zoomed in) — page mode's own
// transform is active for essentially the entire time a page is shown on mobile, unlike pinch-zoom,
// so there was no equivalent "just don't create the transform until needed" escape hatch available
// here; dropping the filter itself instead does the job just as well.
.questionnaire-book__frame--page-mode {
  filter: none;
}

.questionnaire-book__frame--pulse {
  animation: questionnaire-book-pulse 1.5s ease-out;
}

@keyframes questionnaire-book-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba($accent, 0.55);
  }
  70% {
    box-shadow: 0 0 0 10px rgba($accent, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba($accent, 0);
  }
}

.questionnaire-book__halves {
  position: absolute;
  inset: 0;
}

// No background of its own — a page has its own real background (JournalSpreadThumbnail's own
// canvas, or the surrounding book-column's pink card where there's none) that should show through
// cleanly. This used to be a hardcoded white "paper backing": partly so a cover mid-transition
// to/from a spread (one side briefly has no half at all — see `renderedHalves`) wouldn't show a
// stray white block, but that's handled by simply not rendering a half there at all, not by this
// one having a background. The other reason was masking JournalSpreadThumbnail's own letterboxing (it
// fits the page's real aspect ratio inside whatever box this hands it, "contain"-style, rather than
// stretching to match — see its own `pageStyle` comment) — a sub-pixel rounding gap between this
// half's CSS-computed size and that JS-measured inner page reliably left a hairline white gap
// around the page content, reading as an unwanted white outline once the surrounding card stopped
// being white itself (see PhotoUploadPage.vue's pink book-column). `.questionnaire-book__frame`'s
// drop-shadow (not box-shadow) still works fine without this — it follows whatever opaque pixels
// actually render inside, which is now the page's own content directly, not this box.
.questionnaire-book__half {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
  // overflow:hidden alone doesn't reliably clip hit-testing inside the 3D-transformed
  // (preserve-3d) frame: the other half's off-screen content (each window is 200% wide)
  // can still intercept pointer events at points where the two halves visually overlap.
  // clip-path is spec-guaranteed to also restrict hit-testing, so use it as the real clip.
  clip-path: inset(0);
}

.questionnaire-book__window {
  position: absolute;
  top: 0;
  bottom: 0;
}

// The spine between two real page-halves of one spread — a soft shadow gradient converging on the
// center line, not just a flat rule, so it reads as a fold rather than a drawn border. The frame
// always keeps SPREAD_ASPECT_RATIO exactly, so this 50%-based positioning can never drift out of
// sync with the actual rendered halves (no external library resizing the frame independently).
.questionnaire-book__spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 18px;
  margin-left: -9px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.1) 42%,
    rgba(0, 0, 0, 0.16) 50%,
    rgba(0, 0, 0, 0.1) 58%,
    rgba(0, 0, 0, 0) 100%
  );
}

.questionnaire-book__badge {
  position: absolute;
  top: $spacing-2;
  right: $spacing-2;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 $spacing-2;
  border-radius: 999px;
  font-size: 11px;
  font-weight: $font-weight-medium;
  color: $white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.questionnaire-book__badge--partial {
  background: $text-secondary;
}

// Bottom-right, not top-right — the fill badge already owns that corner (see
// `.questionnaire-book__badge` above).
.questionnaire-book__template-btn {
  position: absolute;
  bottom: $spacing-2;
  right: $spacing-2;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba($white, 0.92);
  color: $text-primary;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  transition: background 0.15s ease, transform 0.15s ease;
  // Counter-scales this button back to its normal size against page mode's own enlargement of its
  // ancestor (`--page-mode-btn-scale`, set inline — see `pageModeButtonScale`'s own doc comment) —
  // 1 (a no-op) outside page mode, where the custom property is never set. Anchored at the same
  // corner this button is already pinned to (bottom right), so shrinking it back down doesn't also
  // drag it away from that corner.
  transform: scale(var(--page-mode-btn-scale, 1));
  transform-origin: bottom right;

  &:hover {
    background: $white;
    transform: scale(calc(var(--page-mode-btn-scale, 1) * 1.06));
  }
}

// Mirrors .questionnaire-book__template-btn exactly, just pinned to the opposite (bottom-left)
// corner so the two buttons never collide.
// Lives in the toolbar row below the frame (not overlaid on it like .questionnaire-book__template-
// btn) — only ever rendered on mobile (v-if="isMobileViewport" in the template) — so unlike that
// one, this needs no page-mode counter-scale (see `pageModeButtonScale`'s own comment): it sits
// outside the enlarged transform layer entirely, never grows with it in the first place. A small
// circle (matching that same button's shape) rather than a labeled pill like its two toolbar
// neighbors — pink-accented to match the rest of the mobile book UI, same as their own mobile-only
// look (see .questionnaire-book__reorder-btn's own comment).
.questionnaire-book__view-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid $accent;
  border-radius: 50%;
  background: $white;
  color: $accent-deep;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;

  &:hover {
    border-color: $accent-deep;
  }

  :deep(.v-icon) {
    width: 14px !important;
    height: 14px !important;
    font-size: 14px !important;
  }
}

.questionnaire-book__flap {
  position: absolute;
  top: 0;
  bottom: 0;
  // Must outrank every button that can appear inside a half's own JournalSpreadThumbnail (crop/
  // pick buttons, z-index: 1) as well as the badge/template-switch button above (z-index: 2) —
  // without this, those un-stacked-context absolute-positioned buttons render ON TOP of the flap
  // (any element with an explicit z-index beats one left at the `auto` default, regardless of DOM
  // order), so the target page's controls would flash into view mid-flip, before the leaf
  // animating over them has actually finished landing.
  z-index: 3;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.45, 0.05, 0.35, 1);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.16);
}

// Opaque backdrop so nothing bleeds through behind a real thumbnail (flapFrontWindow/flapBackWindow).
.questionnaire-book__flap-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  backface-visibility: hidden;
  background: $white;
}

.questionnaire-book__flap-face--back {
  transform: rotateY(180deg);
}

.questionnaire-book__nav {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: $spacing-4;
}

.questionnaire-book__arrow {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid $border-default;
  background: $bg-elevated;
  color: $text-primary;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;

  &:hover:not(:disabled) {
    transform: scale(1.06);
  }

  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
}

.questionnaire-book__counter {
  min-width: 160px;
  text-align: center;
  white-space: nowrap;
}

.questionnaire-book__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: $spacing-3;

  @include mobile-only {
    // nowrap (not just shorter labels) is what actually guarantees one line — wrap was the
    // default specifically so these could stack on a truly narrow screen, but the shorter mobile
    // labels below are meant to always fit side by side instead.
    flex-wrap: nowrap;
    gap: 6px;
  }
}

// Two labels per button (see the template) swapped by viewport, rather than one label shortened
// everywhere — desktop keeps the fuller, clearer text since it has the room; only mobile needs
// the compact one to reliably fit both buttons on one line.
.questionnaire-book__btn-label-short {
  display: none;
}

@include mobile-only {
  .questionnaire-book__btn-label-full {
    display: none;
  }

  .questionnaire-book__btn-label-short {
    display: inline;
  }
}

.questionnaire-book__reorder-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: $spacing-1 $spacing-3;
  border: 1px solid $border-default;
  border-radius: 999px;
  background: $bg-elevated;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: $accent;
    color: $accent;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  // Pink-accented pill on white, matching the rest of the mobile book UI (add-tile, hint icons,
  // etc. — see PhotoUploadPage.vue) instead of the neutral gray this reads as by default.
  @include mobile-only {
    gap: 3px;
    padding: 4px 10px;
    border-color: $accent;
    background: $white;
    color: $accent-deep;
    font-size: 10px;

    // v-icon's `size` prop sets width/height/font-size as an inline style — !important is what
    // lets a plain class selector still shrink it to match this button's now-smaller text.
    :deep(.v-icon) {
      width: 12px !important;
      height: 12px !important;
      font-size: 12px !important;
    }
  }
}

</style>
