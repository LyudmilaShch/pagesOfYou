<template>
  <div class="questionnaire-book" :class="{ 'questionnaire-book--fit-height': fitHeight }">
    <div class="questionnaire-book__perspective">
      <div
        class="questionnaire-book__frame"
        :class="{ 'questionnaire-book__frame--pulse': viewingPageId && pulsingPageIds.has(viewingPageId) }"
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

    <div class="questionnaire-book__nav">
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
        :disabled="spreadIds.length < 2"
        @click="reorderDialogOpen = true"
      >
        <v-icon size="16">mdi-swap-horizontal</v-icon>
        Изменить порядок разворотов
      </button>

      <button
        type="button"
        class="questionnaire-book__add-spread"
        :disabled="store.isSaving"
        @click="handleAddSpread"
      >
        <v-icon size="16">mdi-plus</v-icon>
        Добавить 4 страницы
      </button>
    </div>

    <SpreadReorderDialog
      :open="reorderDialogOpen"
      :pages="pages"
      :canvas-data-by-page-id="canvasDataByPageId"
      @close="reorderDialogOpen = false"
    />

    <JournalTemplatePickerDialog
      :open="templatePicker.open"
      :journal-page="templatePicker.page"
      :sequence="templatePicker.sequence"
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
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
} from '@/modules/editor/constants/page.constants'
import { getJournalPageDisplayName } from '../../utils/journal-structure.util'
import type { JournalPage } from '../../types/order.types'
import type { SetJournalPageTemplatePayload } from '../../api/orders.api'
import { useOrderBuilderStore } from '../../stores/order-builder.store'
import JournalTemplatePickerDialog from '../JournalTemplatePickerDialog.vue'
import SpreadReorderDialog from './SpreadReorderDialog.vue'

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
}>()

// A COVER sits where a book's front cover really is — the right side, with nothing (yet) to its
// left. A BACK_COVER mirrors that on the left, with nothing to its right. Only a SPREAD occupies
// both sides at once (the same canvas, windowed into two halves — see `windowFor` below).
function sidesFor(page: JournalPage | undefined): { left: string | null; right: string | null } {
  if (!page) {
    return { left: null, right: null }
  }
  if (page.slotType === 'SPREAD') {
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
    }
  },
  { immediate: true },
)

const viewingIndex = computed(() => props.pages.findIndex((page) => page.id === viewingPageId.value))
const viewingFill = computed(() =>
  viewingPageId.value ? props.fillByPageId.get(viewingPageId.value) ?? null : null,
)

function isSpreadPage(pageId: string | null): boolean {
  return props.pages.find((page) => page.id === pageId)?.slotType === 'SPREAD'
}

// A SPREAD canvas is one continuous image spanning both physical pages (see
// journal-structure.util.ts's buildJournalPageSnapshot) — showing just one half means clipping a
// 200%-wide inner render shifted left/right (what gives the real book look, a visible spine between
// two actual page-halves, without needing two different data sources). A single COVER/BACK_COVER
// canvas IS one physical page already, so it fills its half-slot at its own natural 100% width —
// windowing it with the 200% trick would wrongly crop it in half.
function windowFor(pageId: string | null, side: 'left' | 'right'): { left: string; width: string } {
  if (!isSpreadPage(pageId)) {
    return { left: '0%', width: '100%' }
  }
  return side === 'left' ? { left: '0%', width: '200%' } : { left: '-100%', width: '200%' }
}

interface RenderedHalf {
  key: string
  pageId: string
  left: string
  width: string
  windowLeft: string
  windowWidth: string
  canvasData: CanvasData | null
}

// Only while at rest on a lone cover does the frame itself shrink to page width — mid-flip it stays
// full spread width throughout (avoids having to animate the frame's own size in sync with the
// flap's rotation, which `turning` sidesteps entirely: it snaps to full width the instant a flip
// starts, and only shrinks back afterwards if the flip actually landed on another lone cover).
const isSingleSlotAtRest = computed(() => !turning.value && Boolean(leftPageId.value) !== Boolean(rightPageId.value))
const singleSlotSide = computed<'left' | 'right' | null>(() => {
  if (!isSingleSlotAtRest.value) {
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

  // Height is the definite dimension here (from the flex parent — see .questionnaire-book's own
  // `--fit-height` rule below); `aspect-ratio` then derives width from it, the exact mirror of the
  // normal width-driven case. A lone cover needs no special-cased "50%" here the way the
  // width-driven branch does: its own PAGE_ASPECT_RATIO is already half of SPREAD_ASPECT_RATIO, so
  // deriving width from the SAME 100%-height reproduces that same relative size on its own.
  if (props.fitHeight) {
    return { height: '100%', width: 'auto', maxWidth: '100%', aspectRatio: ratio, ...margins }
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

// Only SPREAD slots are reorderable — the cover/back-cover stay pinned at the very start/end (same
// rule `reorderJournalSpreads`/JournalStructurePanel.vue's drag-and-drop already enforce). Just
// used to gate the "Изменить порядок" button (need at least 2 to reorder) — SpreadReorderDialog
// does the actual reordering.
const spreadIds = computed(() => props.pages.filter((page) => page.slotType === 'SPREAD').map((page) => page.id))
const reorderDialogOpen = ref(false)

function flip(direction: 'next' | 'prev'): void {
  if (turning.value) {
    return
  }

  const targetIndex = viewingIndex.value + (direction === 'next' ? 1 : -1)
  if (targetIndex < 0 || targetIndex >= props.pages.length) {
    return
  }

  const currentPage = props.pages[viewingIndex.value]
  const targetPage = props.pages[targetIndex]
  const targetSides = sidesFor(targetPage)

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
    }, 620),
  )
}

const snackbar = reactive({ show: false, text: '', color: 'success' as 'success' | 'error' })

function notify(text: string, color: 'success' | 'error' = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
  sequence: { current: number; total: number } | null
}>({ open: false, page: null, sequence: null })

// Queue of spreads still waiting for a template choice — empty outside the "just added N new
// spreads" flow (see `handleAddSpread`), so `advanceTemplateQueue` closing the dialog once it's
// empty also correctly closes a single ad-hoc pick (`openTemplatePicker`) after just one apply.
const templateQueue = ref<JournalPage[]>([])
const templateQueueTotal = ref(0)

function openTemplatePicker(): void {
  const page = props.pages.find((item) => item.id === viewingPageId.value) ?? null
  if (!page) {
    return
  }
  templateQueue.value = []
  templateQueueTotal.value = 0
  templatePicker.page = page
  templatePicker.sequence = null
  templatePicker.open = true
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
  templatePicker.sequence = null
  templateQueue.value = []
  templateQueueTotal.value = 0
}

/** Pops the next spread off `templateQueue` and reopens the dialog on it, or closes the dialog
 * once the queue (and any single ad-hoc pick) is exhausted. */
function advanceTemplateQueue(): void {
  const next = templateQueue.value.shift()
  if (!next) {
    closeTemplatePicker()
    return
  }

  const current = templateQueueTotal.value - templateQueue.value.length
  templatePicker.page = next
  templatePicker.sequence = { current, total: templateQueueTotal.value }
  templatePicker.open = true
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    notify('Шаблон применён')
    advanceTemplateQueue()
  } catch {
    notify(store.orderError ?? 'Не удалось применить шаблон', 'error')
  }
}

async function handleAddSpread(): Promise<void> {
  // Adds 2 spreads (4 pages) at once, both starting on the same auto-picked default template —
  // see order-builder.store.ts's addJournalSpread doc comment. Diffing spread ids before/after
  // queues both new spreads through the template picker right away, one after another, instead of
  // leaving the default silently applied to either.
  const previousSpreadIds = new Set(
    (store.order?.journalPages ?? []).filter((page) => page.slotType === 'SPREAD').map((page) => page.id),
  )

  try {
    await store.addJournalSpread()
    notify('4 страницы добавлены')

    const newSpreads = (store.order?.journalPages ?? []).filter(
      (page) => page.slotType === 'SPREAD' && !previousSpreadIds.has(page.id),
    )
    if (newSpreads.length > 0) {
      templateQueue.value = newSpreads
      templateQueueTotal.value = newSpreads.length
      advanceTemplateQueue()
    }
  } catch {
    notify(store.orderError ?? 'Не удалось добавить страницы', 'error')
  }
}

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers = []
})
</script>

<style scoped lang="scss">
.questionnaire-book {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  width: 100%;
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
  width: auto;
  height: 100%;
  display: flex;
  justify-content: center;
}

.questionnaire-book__perspective {
  width: 100%;
  perspective: 1800px;
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

// White lives here, not on the frame — while a cover is transitioning to/from a spread, one side
// briefly has no half at all (see `renderedHalves`), and it should show whatever's behind the book
// (the page's own backdrop) rather than a stray white block where there's genuinely no page yet.
.questionnaire-book__half {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
  background: $white;
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

  &:hover {
    background: $white;
    transform: scale(1.06);
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
}

.questionnaire-book__add-spread {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: $spacing-1 $spacing-3;
  border: 1px dashed $border-default;
  border-radius: 999px;
  background: transparent;
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
}
</style>
