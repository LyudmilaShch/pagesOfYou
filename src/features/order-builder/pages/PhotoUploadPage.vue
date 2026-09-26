<template>
  <div v-if="isLoading" class="photo-upload-page__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка…</p>
  </div>

  <div v-else-if="loadErrorMessage" class="photo-upload-page__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadErrorMessage }}</p>
    <v-btn variant="outlined" :to="{ name: 'create-order' }">Начать заново</v-btn>
  </div>

  <div v-else class="photo-upload-page">

    <!-- ── Top navigation bar — same chrome as Шаг 1/3 (CreateOrderPage.vue/QuestionnairePage.vue) ── -->
    <header class="photo-upload-page__topbar">
      <div class="photo-upload-page__topbar-inner">
        <router-link to="/" class="photo-upload-page__brand">Вау, ми!</router-link>

        <div class="photo-upload-page__steps-label" aria-label="Шаг 2 из 5">
          <span class="photo-upload-page__steps-current">2</span>
          <span class="photo-upload-page__steps-sep">/</span>
          <span class="photo-upload-page__steps-total">5</span>
        </div>
      </div>
    </header>

    <div class="photo-upload-page__step-progress">
      <v-progress-linear :model-value="ORDER_STEP_PROGRESS" color="primary" bg-opacity="0.15" height="3" />
    </div>

    <!-- Mobile-only stepper — same 5 steps as .photo-upload-page__steps-label above, just a fuller
         visual (desktop keeps the thin progress bar instead). This page is always step 2. -->
    <ol class="photo-upload-page__stepper" aria-label="Шаг 2 из 5: Фото">
      <li
        v-for="step in ORDER_STEPS"
        :key="step.step"
        class="photo-upload-page__stepper-item"
        :class="{
          'photo-upload-page__stepper-item--done': step.step < 2,
          'photo-upload-page__stepper-item--active': step.step === 2,
        }"
      >
        <span class="photo-upload-page__stepper-node">
          <v-icon v-if="step.step < 2" size="10">mdi-check</v-icon>
          <template v-else>{{ step.step }}</template>
        </span>
        <span class="photo-upload-page__stepper-label">{{ step.label }}</span>
      </li>
    </ol>

    <!-- ── Body: 3D spread book (left) + uploader (right) — same split as the anketa step ────── -->
    <div class="photo-upload-page__body">
      <div class="photo-upload-page__body-inner">
        <!-- Mobile-only: title/subtitle duplicated here so they land ABOVE the book card in the
             column stack — the "real" intro further down (inside main) hides on mobile via CSS,
             see .photo-upload-page__intro. -->
        <header class="photo-upload-page__intro-mobile">
          <h1 class="photo-upload-page__title text-h3">Добавьте фотографии в журнал</h1>
          <p class="photo-upload-page__subtitle text-body text-secondary">
            Загрузите {{ requiredPhotoCount }} фотографий — мы автоматически расставим их по страницам журнала. Хотите изменить расположение? Перетащите фото из галереи на нужную страницу. 
          </p>
        </header>

        <div class="photo-upload-page__book-column" aria-label="Развороты журнала">
          <QuestionnaireBook
            ref="bookRef"
            :pages="store.order?.journalPages ?? []"
            :canvas-data-by-page-id="canvasDataByPageId"
            :focus-page-id="focusPageId"
            :pulsing-page-ids="pulsingPageIds"
            :fill-by-page-id="EMPTY_FILL_MAP"
            :pending-element-ids="EMPTY_ELEMENT_IDS"
            :drop-enabled="manualPlacementMode"
            show-structure-controls
            :hide-nav="isMobileViewport"
            :fit-height="isMobileViewport"
            crop-enabled
            pick-enabled
            @drop-photo="handleDropPhoto"
            @crop-photo="openCropEditor"
            @pick-photo="openPhotoPicker"
            @update:viewing="bookViewing = $event"
          >
            <!-- Mobile-only — same round prev/next arrows as the reference design, calling into the
                 book's own exposed `flip()` (its built-in nav row is hidden via hide-nav above).
                 Rendered into `nav-overlay` (not a plain sibling here) so they're positioned against
                 the book's own frame specifically, not the whole mobile card (which also includes
                 the "Изменить порядок"/"Добавить 4 страницы" toolbar below the frame) — see that
                 slot's own doc comment in QuestionnaireBook.vue. -->
            <template #nav-overlay>
              <button
                type="button"
                class="photo-upload-page__book-arrow photo-upload-page__book-arrow--prev"
                aria-label="Предыдущая страница"
                :disabled="!bookViewing || bookViewing.index <= 0"
                @click="bookRef?.flip('prev')"
              >
                <v-icon size="18">mdi-chevron-left</v-icon>
              </button>
              <button
                type="button"
                class="photo-upload-page__book-arrow photo-upload-page__book-arrow--next"
                aria-label="Следующая страница"
                :disabled="!bookViewing || bookViewing.index >= bookViewing.total - 1"
                @click="bookRef?.flip('next')"
              >
                <v-icon size="18">mdi-chevron-right</v-icon>
              </button>
            </template>
          </QuestionnaireBook>
        </div>

        <!-- Mobile-only — replaces the book's own built-in nav row (hidden via hide-nav above). -->
        <div class="photo-upload-page__book-hint">
          <span class="photo-upload-page__book-hint-icon" aria-hidden="true">
            <v-icon size="18">mdi-gesture-swipe-horizontal</v-icon>
          </span>
          <p class="photo-upload-page__book-hint-text">
            Перетащите фото из галереи на страницу журнала. Вы также можете листать журнал и
            выбрать другую страницу.
          </p>
          <span v-if="bookViewing" class="photo-upload-page__book-hint-counter">
            Страница {{ bookViewing.index + 1 }} из {{ bookViewing.total }}
          </span>
        </div>

        <main class="photo-upload-page__main">
          <div class="photo-upload-page__main-scroll">
          <div class="photo-upload-page__container">
            <header class="photo-upload-page__intro">
              <p class="photo-upload-page__eyebrow text-caption text-secondary">Шаг 2 — Фото</p>
              <h1 class="photo-upload-page__title text-h3">Добавьте фотографии в журнал</h1>
              <p class="photo-upload-page__subtitle text-body text-secondary">
                Загрузите {{ requiredPhotoCount }} фотографий — мы автоматически расставим их по страницам журнала. Хотите изменить расположение? Перетащите фото из галереи на нужную страницу. 
              </p>
            </header>

            <div
              class="photo-upload-page__dropzone"
              :class="{ 'photo-upload-page__dropzone--active': isDragActive }"
              role="button"
              tabindex="0"
              @dragover.prevent="isDragActive = true"
              @dragleave.prevent="isDragActive = false"
              @drop.prevent="handleDrop"
              @click="fileInputRef?.click()"
              @keydown.enter="fileInputRef?.click()"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                multiple
                class="photo-upload-page__file-input"
                @change="handleFilesSelected"
                @click.stop
              />
              <span class="photo-upload-page__dropzone-icon">
                <v-progress-circular v-if="uploading" indeterminate size="16" width="2" color="primary" />
                <v-icon v-else size="16">mdi-arrow-up</v-icon>
              </span>
              <p class="photo-upload-page__dropzone-title text-body-sm">Перетащите фото сюда</p>
              <p class="photo-upload-page__dropzone-hint text-body-sm text-secondary">
                или нажмите, чтобы выбрать с устройства
              </p>
            </div>

            <div class="photo-upload-page__stats">
              <span class="photo-upload-page__stats-count">Загружено {{ photos.length }} фото</span>
              <span class="photo-upload-page__stats-hint text-body-sm text-secondary">
                Нужно {{ requiredPhotoCount }} фото
              </span>
            </div>

            <!-- Mobile-only — replaces .photo-upload-page__stats (desktop, hidden here) with a
                 title + fill progress bar against `requiredPhotoCount`. -->
            <div class="photo-upload-page__mobile-stats">
              <div class="photo-upload-page__mobile-stats-row">
                <span class="photo-upload-page__mobile-stats-title">Ваши фотографии</span>
                <span class="photo-upload-page__mobile-stats-count">
                  {{ photos.length }} из {{ requiredPhotoCount }} загружено
                </span>
              </div>
              <v-progress-linear
                :model-value="requiredPhotoCount > 0 ? (photos.length / requiredPhotoCount) * 100 : 0"
                color="primary"
                bg-color="#f1d6de"
                height="6"
                rounded
              />
            </div>

            <div v-if="photos.length > 0" class="photo-upload-page__grid-header">
              <span class="photo-upload-page__grid-title text-body-sm text-secondary">Загруженные фото</span>
              <v-btn
                variant="text"
                size="small"
                :color="manualPlacementMode ? 'primary' : undefined"
                @click="manualPlacementToggle = !manualPlacementToggle"
              >
                {{ manualPlacementMode ? 'Готово' : 'Расставить вручную' }}
              </v-btn>
            </div>
            <p v-if="manualPlacementMode" class="photo-upload-page__manual-hint text-body-sm text-secondary">
              Перетащите фото на нужное место в развороте слева
            </p>

            <div v-if="photos.length > 0 || isMobileViewport" class="photo-upload-page__grid">
              <button
                type="button"
                class="photo-upload-page__add-tile"
                aria-label="Добавить ещё фото"
                @click="fileInputRef?.click()"
              >
                <v-icon size="14" color="primary">mdi-plus</v-icon>
                <span class="photo-upload-page__add-tile-label">Добавить ещё фото</span>
              </button>

              <!-- `display:contents` on desktop (see CSS) keeps these thumbs as direct grid items of
                   .photo-upload-page__grid, unchanged from before this wrapper existed — on mobile it
                   becomes the actual scroll container, so only the photos scroll, not the "+" tile
                   above. -->
              <div class="photo-upload-page__thumbs-scroll">
                <div
                  v-for="photo in photos"
                  :key="photo.id"
                  class="photo-upload-page__thumb"
                  :class="{ 'photo-upload-page__thumb--draggable': manualPlacementMode }"
                  :draggable="manualPlacementMode"
                  @dragstart="handleDragStart($event, photo)"
                  @pointerdown="handleThumbPointerDown($event, photo)"
                >
                  <img :src="photo.url" :alt="photo.originalName ?? ''" />
                  <button
                    v-if="usageByUrl.get(photo.url)?.length"
                    type="button"
                    class="photo-upload-page__thumb-usage"
                    :class="{ 'photo-upload-page__thumb-usage--multi': (usageByUrl.get(photo.url)?.length ?? 0) > 2 }"
                    :aria-label="`Используется на ${usageByUrl.get(photo.url)?.length} страницах`"
                    @click.stop="handleUsageClick(photo.url)"
                  >
                    <v-icon size="9">mdi-image-multiple</v-icon>
                    {{ usageByUrl.get(photo.url)?.length }}
                  </button>
                  <button
                    type="button"
                    class="photo-upload-page__thumb-remove"
                    aria-label="Удалить фото"
                    @click="removePhoto(photo)"
                  >
                    <v-icon size="10">mdi-close</v-icon>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="coverSlots.length > 0 && photos.length > 0" class="photo-upload-page__cover">
              <h2 class="photo-upload-page__cover-title text-body">Фото на обложке</h2>
              <div class="photo-upload-page__cover-slots">
                <div v-for="slot in coverSlots" :key="slot.elementId" class="photo-upload-page__cover-slot">
                  <div class="photo-upload-page__cover-preview">
                    <img v-if="slot.url" :src="slot.url" alt="" />
                    <v-icon v-else :size="isMobileViewport ? 18 : 24" color="grey">mdi-image-outline</v-icon>
                  </div>
                  <v-btn variant="outlined" size="small" @click="openCoverPicker(slot.elementId)">
                    {{ slot.url ? 'Заменить' : 'Выбрать фото' }}
                  </v-btn>
                </div>
              </div>
            </div>

          </div>
          </div>
        </main>
      </div>
    </div>

    <!-- ── Bottom action bar — same chrome as Шаг 1/3: moves between order-creation steps ───── -->
    <footer class="photo-upload-page__actions">
      <div class="photo-upload-page__actions-inner">
        <v-btn
          variant="outlined"
          :size="isMobileViewport ? 'default' : 'large'"
          color="primary"
          class="photo-upload-page__btn-back"
          @click="goToPreviousStep"
        >
          Назад
        </v-btn>

        <v-btn
          color="primary"
          :size="isMobileViewport ? 'default' : 'large'"
          class="photo-upload-page__btn-next"
          @click="goToNextStep"
        >
          Продолжить
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
      </div>
    </footer>

    <!-- Follows the finger during a touch drag (see handleThumbHandlePointerDown) — native HTML5
         DnD has no visual equivalent on touch, so this stands in for the ghost image a mouse drag
         gets for free. -->
    <div
      v-if="touchDrag"
      class="photo-upload-page__drag-ghost"
      :style="{ left: `${touchDrag.x}px`, top: `${touchDrag.y}px` }"
    >
      <img :src="touchDrag.photo.url" alt="" />
    </div>

    <PhotoGalleryPickerDialog
      :open="pickerTarget !== null"
      :scope="galleryScope"
      @select="handlePickerSelect"
      @close="closePhotoPicker"
    />

    <v-dialog v-model="usageModalOpen" max-width="420">
      <v-card>
        <v-card-title class="photo-upload-page__usage-modal-title">
          Где используется фото
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Закрыть" @click="usageModalPhotoUrl = null" />
        </v-card-title>
        <v-card-text>
          <ul class="photo-upload-page__usage-list">
            <li v-for="entry in usageModalEntries" :key="entry.elementId">
              <button type="button" class="photo-upload-page__usage-item" @click="goToUsage(entry)">
                {{ entry.pageLabel }}
                <v-icon size="16">mdi-chevron-right</v-icon>
              </button>
            </li>
          </ul>
        </v-card-text>
      </v-card>
    </v-dialog>

    <PhotoCropModal
      :open="cropModal.open"
      :image-url="cropModal.imageUrl"
      :box-width="cropModal.boxWidth"
      :box-height="cropModal.boxHeight"
      :fit-mode="cropModal.fitMode"
      :initial-crop="cropModal.initialCrop"
      :loading="cropModal.saving"
      @close="closeCropEditor"
      @save="handleCropSave"
    />

    <BaseModal v-model="incompletePhotosModalOpen" labelledby="incomplete-photos-title" narrow>
      <div class="photo-upload-page__incomplete">
        <div class="photo-upload-page__incomplete-icon" aria-hidden="true">
          <v-icon size="28" color="white">mdi-image-off-outline</v-icon>
        </div>

        <h2 id="incomplete-photos-title" class="photo-upload-page__incomplete-title">Не хватает фото</h2>
        <p class="photo-upload-page__incomplete-subtitle">
          Вы загрузили ещё не все фото для журнала — часть мест в разворотах останется пустой.
        </p>

        <div class="photo-upload-page__incomplete-actions">
          <v-btn color="primary" variant="flat" size="large" block @click="incompletePhotosModalOpen = false">
            Вернуться и загрузить фото
          </v-btn>
          <v-btn variant="text" size="large" block @click="continueWithoutPhotos">
            Загружу позже
          </v-btn>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isPhotoElement, type PhotoFitMode } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import type { PhotoCropState } from '@/modules/editor/utils/photo-crop.util'
import { photoGalleryApi, type GalleryPhoto } from '../api/photo-gallery.api'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { collectPhotoSlotPreview } from '../utils/missing-photos.util'
import QuestionnaireBook from '../components/questionnaire/QuestionnaireBook.vue'
import PhotoGalleryPickerDialog from '../components/PhotoGalleryPickerDialog.vue'
import PhotoCropModal from '../components/PhotoCropModal.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

// Stable empty instances — QuestionnaireBook has no per-question fill concept on this step (photos
// here aren't bound to a specific spread yet), but its props aren't optional; reusing the SAME
// empty instance (rather than a fresh literal per render) avoids handing it a "new" Map on every
// re-render, which would otherwise needlessly invalidate anything memoized off it.
const EMPTY_FILL_MAP: Map<string, { answered: number; total: number }> = new Map()
const EMPTY_ELEMENT_IDS: Set<string> = new Set()

// This is Шаг 2 of 5 — same hardcoded step number as .photo-upload-page__steps-label below.
const ORDER_STEP_PROGRESS = (2 / 5) * 100

// Mobile stepper labels — mirrors the other 4 order-creation pages' own "Шаг N — ..." eyebrow text
// (CreateOrderPage.vue/QuestionnairePage.vue/JournalReviewPage.vue/CheckoutPage.vue), just listed
// together here since this is the only page that renders all 5 at once.
const ORDER_STEPS = [
  { step: 1, label: 'Журнал' },
  { step: 2, label: 'Фото' },
  { step: 3, label: 'Анкета' },
  { step: 4, label: 'Проверка' },
  { step: 5, label: 'Оплата' },
]

const route = useRoute()
const router = useRouter()
const store = useOrderBuilderStore()

const orderId = computed(() => route.params.orderId as string)
const galleryScope = computed(() => getGalleryScope(store))

const isLoading = ref(true)
const loadErrorMessage = ref<string | null>(null)
const photos = ref<GalleryPhoto[]>([])
const uploading = ref(false)
const isDragActive = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
// Photos auto-place as they upload (see `autoPlacePhoto`) — this just lets the user override that
// afterwards by dragging a specific photo from the grid onto a specific spread in the book. On
// mobile it's always on (see `isMobileViewport`) since dragging is the only way to place a photo
// there — there's no separate toggle button shown, only the desktop grid-header offers one.
const manualPlacementToggle = ref(false)
const manualPlacementMode = computed(() => isMobileViewport.value || manualPlacementToggle.value)

// Same threshold as the `mobile-only` SCSS mixin (`$breakpoint-mobile-max: 767px`).
const isMobileViewport = ref(false)
let mobileMediaQuery: MediaQueryList | null = null

function updateIsMobileViewport(): void {
  isMobileViewport.value = mobileMediaQuery?.matches ?? false
}

// The exact number of photo-placeholder slots across the whole journal — how many photos this
// specific journal (magazine type + spread count) actually needs, not a generic recommendation.
const requiredPhotoCount = computed(() => {
  let count = 0
  for (const page of store.order?.journalPages ?? []) {
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    count += leaves.filter((leaf) => isPhotoElement(leaf)).length
  }
  return count
})

interface CoverSlot {
  elementId: string
  url: string | null
}

// The cover's own photo-placeholder element(s) — usually just one, but a collage-style cover
// template could have more. Shown as its own picker (not left to auto-placement's page order)
// since the cover is the one photo the user is most likely to want to choose deliberately.
const coverPage = computed(() => store.order?.journalPages.find((page) => page.slotType === 'COVER') ?? null)
const coverSlots = computed<CoverSlot[]>(() => {
  const page = coverPage.value
  if (!page) {
    return []
  }
  const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
  const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
  return leaves
    .filter((leaf) => isPhotoElement(leaf))
    .map((leaf) => ({ elementId: leaf.id, url: valueByElementId.get(leaf.id)?.jsonValue?.url ?? null }))
})

// Picking a photo for a specific slot from the gallery — used by both the dedicated cover picker
// above and the "pick" icon on any empty slot in the book (see `openPhotoPicker`/`pick-photo`).
const pickerTarget = ref<{ journalPageId: string; elementId: string } | null>(null)

function openCoverPicker(elementId: string): void {
  if (!coverPage.value) {
    return
  }
  openPhotoPicker(coverPage.value.id, elementId)
}

function openPhotoPicker(journalPageId: string, elementId: string): void {
  pickerTarget.value = { journalPageId, elementId }
}

function closePhotoPicker(): void {
  pickerTarget.value = null
}

async function handlePickerSelect(url: string): Promise<void> {
  const target = pickerTarget.value
  pickerTarget.value = null
  if (!target) {
    return
  }
  try {
    await store.savePlaceholders(target.journalPageId, [
      { elementId: target.elementId, valueType: 'PHOTO', jsonValue: { url } },
    ])
  } catch {
    // orderError is set in the store; the picker just closes either way.
  }
}

// The book jumps here (no flip animation) when the user clicks a usage badge/list entry — see
// `handleUsageClick`/`goToUsage`. `pulsingPageIds` briefly highlights the same page, same pattern
// as QuestionnairePage.vue's own post-answer pulse.
const focusPageId = ref<string | null>(null)
const pulsingPageIds = ref<Set<string>>(new Set())
// Mirrors QuestionnaireBook's own built-in nav state — see `hide-nav`/`update:viewing` on its
// usage above; only actually read on mobile (.photo-upload-page__book-hint), but harmless to keep
// updated on desktop too, since the emit fires regardless of `hide-nav`.
const bookViewing = ref<{ index: number; total: number; label: string } | null>(null)
// Drives the mobile-only round prev/next arrows via the book's own exposed `flip()` — see
// .photo-upload-page__book-arrow below.
const bookRef = ref<InstanceType<typeof QuestionnaireBook> | null>(null)
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function jumpTo(journalPageId: string): void {
  focusPageId.value = journalPageId
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  pulsingPageIds.value = new Set([journalPageId])
  pulseTimer = setTimeout(() => {
    pulsingPageIds.value = new Set()
  }, 1500)
}

interface PhotoUsage {
  journalPageId: string
  elementId: string
  pageLabel: string
}

// Where each uploaded photo's URL is currently placed across the journal — a photo already used
// once elsewhere can still be picked again (nothing stops that), so this tracks every placement,
// not just the first.
const usageByUrl = computed<Map<string, PhotoUsage[]>>(() => {
  const map = new Map<string, PhotoUsage[]>()
  const pages = store.order?.journalPages ?? []
  let spreadIndex = 0

  for (const page of pages) {
    if (page.slotType === 'SPREAD') {
      spreadIndex += 1
    }
    const pageLabel = getJournalPageDisplayName(page, spreadIndex)

    for (const value of page.placeholderValues) {
      const url = value.jsonValue?.url
      if (value.valueType !== 'PHOTO' || !url) {
        continue
      }
      const entry: PhotoUsage = { journalPageId: page.id, elementId: value.elementId, pageLabel }
      const list = map.get(url)
      if (list) {
        list.push(entry)
      } else {
        map.set(url, [entry])
      }
    }
  }
  return map
})

const usageModalPhotoUrl = ref<string | null>(null)
const usageModalOpen = computed({
  get: () => usageModalPhotoUrl.value !== null,
  set: (value: boolean) => {
    if (!value) {
      usageModalPhotoUrl.value = null
    }
  },
})
const usageModalEntries = computed<PhotoUsage[]>(
  () => (usageModalPhotoUrl.value ? usageByUrl.value.get(usageModalPhotoUrl.value) : undefined) ?? [],
)

/** One use — jump straight there. More than one (whether or not the badge is showing as "red") —
 * there's no single obvious destination, so open the list instead. */
function handleUsageClick(url: string): void {
  const usage = usageByUrl.value.get(url) ?? []
  if (usage.length === 1) {
    jumpTo(usage[0].journalPageId)
    return
  }
  if (usage.length > 1) {
    usageModalPhotoUrl.value = url
  }
}

function goToUsage(entry: PhotoUsage): void {
  jumpTo(entry.journalPageId)
  usageModalPhotoUrl.value = null
}

// Same base-layer materialization QuestionnairePage.vue uses for the book preview — no live
// overlay needed here, since nothing on this page edits any placeholder value.
const canvasDataByPageId = computed(() => {
  const map = new Map<string, ReturnType<typeof materializeCanvasData>>()
  for (const page of store.order?.journalPages ?? []) {
    map.set(page.id, materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues))
  }
  return map
})

/** Mirrors QuestionnairePage.vue's ensureOrderLoaded 1-1: a local draft only exists once the user
 * has already gone through CreateOrderPage in this session — a cold URL hit for a guest has
 * nothing to load. */
async function ensureOrderLoaded(): Promise<void> {
  if (store.order?.id === orderId.value) {
    return
  }

  if (orderId.value.startsWith('local-')) {
    throw new Error(
      'Черновик заказа был потерян (например, из-за обновления страницы) — начните заново.',
    )
  }

  await store.loadOrder(orderId.value)
}

async function load(): Promise<void> {
  isLoading.value = true
  loadErrorMessage.value = null

  try {
    await ensureOrderLoaded()
    if (!store.order) {
      throw new Error('Заказ не найден.')
    }
    photos.value = await photoGalleryApi.list(galleryScope.value)
  } catch (err: unknown) {
    loadErrorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить страницу.'
  } finally {
    isLoading.value = false
  }
}

/** The next empty photo-placeholder slot to auto-fill, in journal order — skips any element with
 * its own `questionKey` (a slot the anketa's IMAGE/GALLERY questions own; auto-placement would
 * fight over it, since a direct placeholder write here is marked OVERRIDDEN and would permanently
 * block that question's own answer from ever syncing into it — see `applyLocalPlaceholders`), and
 * skips the COVER entirely — that's a deliberate choice via `coverSlots`/`openCoverPicker` above,
 * not something the first upload should just happen to land on. */
function findNextEmptyAutoFillSlot(): { journalPageId: string; elementId: string } | null {
  for (const page of store.order?.journalPages ?? []) {
    if (page.slotType === 'COVER') {
      continue
    }
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))

    for (const leaf of leaves) {
      if (!isPhotoElement(leaf) || leaf.questionKey) {
        continue
      }
      if (valueByElementId.get(leaf.id)?.jsonValue?.url?.trim()) {
        continue
      }
      return { journalPageId: page.id, elementId: leaf.id }
    }
  }
  return null
}

async function autoPlacePhoto(url: string): Promise<void> {
  const slot = findNextEmptyAutoFillSlot()
  if (!slot) {
    return
  }
  try {
    await store.savePlaceholders(slot.journalPageId, [
      { elementId: slot.elementId, valueType: 'PHOTO', jsonValue: { url } },
    ])
  } catch {
    // Best-effort — the photo is still safely in the gallery either way; the user can place it
    // manually later via the advanced editor if auto-placement failed.
  }
}

async function uploadFiles(files: File[]): Promise<void> {
  if (files.length === 0) {
    return
  }

  uploading.value = true
  try {
    for (const file of files) {
      try {
        const dimensions = await getImageDimensions(file).catch(() => undefined)
        const uploaded = await photoGalleryApi.upload(galleryScope.value, file, dimensions)
        photos.value = [uploaded, ...photos.value]
        await autoPlacePhoto(uploaded.url)
      } catch {
        // Best-effort per file — a failed upload just doesn't get added, same as
        // QuestionGalleryField.vue's own bulk-upload loop.
      }
    }
  } finally {
    uploading.value = false
  }
}

function handleFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  void uploadFiles(files)
}

function handleDrop(event: DragEvent): void {
  isDragActive.value = false
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  void uploadFiles(files.filter((file) => file.type.startsWith('image/')))
}

/** Starts dragging an already-uploaded photo out of the grid — only while manual placement mode is
 * on, so an accidental drag (e.g. while reaching for the remove button) can't happen otherwise. The
 * URL travels as plain text; QuestionnaireBook/JournalSpreadThumbnail read it back on drop. */
function handleDragStart(event: DragEvent, photo: GalleryPhoto): void {
  if (!manualPlacementMode.value || !event.dataTransfer) {
    return
  }
  event.dataTransfer.setData('text/plain', photo.url)
  event.dataTransfer.effectAllowed = 'copy'
}

async function handleDropPhoto(pageId: string, elementId: string, url: string): Promise<void> {
  try {
    await store.savePlaceholders(pageId, [{ elementId, valueType: 'PHOTO', jsonValue: { url } }])
  } catch {
    // orderError is set in the store; nothing further to do here.
  }
}

// ── Touch drag-and-drop ──────────────────────────────────────────────────────────────────────
// Native HTML5 DnD (draggable/@dragstart/@dragover/@drop, see handleDragStart above and
// JournalSpreadThumbnail.vue's own drop handling) never fires from a touch gesture — most mobile
// browsers don't start a native drag from touch at all. This is a parallel Pointer Events path,
// mirroring SpreadReorderDialog.vue's own touch-compatible drag handle: a small handle icon on
// each thumb starts the drag immediately on touch (touch-action: none, see CSS), while the rest
// of the thumb keeps its default touch-action so swiping it still scrolls the row. An earlier
// version tried to disambiguate "scroll" from "drag" on the whole thumb via a long-press timer —
// unreliable in practice, since `touch-action: pan-x` lets the browser commit the gesture to
// native scrolling (and fire pointercancel) as soon as movement starts, regardless of any JS
// timer. A dedicated handle with touch-action: none sidesteps that entirely.
const touchDrag = ref<{ photo: GalleryPhoto; x: number; y: number } | null>(null)

function handleThumbPointerDown(event: PointerEvent, photo: GalleryPhoto): void {
  // Was gated by a dedicated drag-handle icon rendered only on mobile (`v-if="isMobileViewport"`)
  // — now the whole thumb starts the drag directly (on request), so this guard replaces that.
  if (event.pointerType === 'mouse' || !isMobileViewport.value) {
    return
  }
  event.preventDefault()
  touchDrag.value = { photo, x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', handleTouchDragMove)
  window.addEventListener('pointerup', handleTouchDragEnd)
  window.addEventListener('pointercancel', handleTouchDragCancel)
}

function handleTouchDragMove(event: PointerEvent): void {
  if (!touchDrag.value) {
    return
  }
  event.preventDefault()
  touchDrag.value = { ...touchDrag.value, x: event.clientX, y: event.clientY }
}

function stopTouchDragTracking(): void {
  window.removeEventListener('pointermove', handleTouchDragMove)
  window.removeEventListener('pointerup', handleTouchDragEnd)
  window.removeEventListener('pointercancel', handleTouchDragCancel)
}

function findDropTargetAt(clientX: number, clientY: number): { pageId: string; elementId: string } | null {
  const el = document.elementFromPoint(clientX, clientY)
  const elementNode = el?.closest('[data-element-id]') as HTMLElement | null
  const pageNode = el?.closest('[data-page-id]') as HTMLElement | null
  const elementId = elementNode?.dataset.elementId
  const pageId = pageNode?.dataset.pageId
  return elementId && pageId ? { pageId, elementId } : null
}

function handleTouchDragEnd(event: PointerEvent): void {
  stopTouchDragTracking()
  const drag = touchDrag.value
  touchDrag.value = null
  if (!drag) {
    return
  }

  const target = findDropTargetAt(event.clientX, event.clientY)
  if (target) {
    void handleDropPhoto(target.pageId, target.elementId, drag.photo.url)
  }
}

function handleTouchDragCancel(): void {
  stopTouchDragTracking()
  touchDrag.value = null
}

const cropModal = reactive<{
  open: boolean
  journalPageId: string | null
  elementId: string | null
  imageUrl: string | null
  boxWidth: number
  boxHeight: number
  fitMode: PhotoFitMode | undefined
  initialCrop: PhotoCropState
  saving: boolean
}>({
  open: false,
  journalPageId: null,
  elementId: null,
  imageUrl: null,
  boxWidth: 0,
  boxHeight: 0,
  fitMode: undefined,
  initialCrop: { cropX: 0, cropY: 0, imageScale: 1 },
  saving: false,
})

/** The clicked element's CURRENT (materialized) state — box size, fit mode, and whatever crop is
 * already saved on it — comes from the same `canvasDataByPageId`/`journalPages` the book itself
 * renders from, so the crop editor always starts from exactly what's on screen. */
function openCropEditor(journalPageId: string, elementId: string): void {
  const canvas = canvasDataByPageId.value.get(journalPageId)
  const page = store.order?.journalPages.find((item) => item.id === journalPageId)
  if (!canvas || !page) {
    return
  }

  const leaf = flattenTree(canvas.elements).find((item) => item.id === elementId)
  if (!leaf || !isPhotoElement(leaf) || !leaf.defaultImageUrl) {
    return
  }

  const existing = page.placeholderValues.find((value) => value.elementId === elementId)?.jsonValue

  cropModal.journalPageId = journalPageId
  cropModal.elementId = elementId
  cropModal.imageUrl = leaf.defaultImageUrl
  cropModal.boxWidth = leaf.size.width
  cropModal.boxHeight = leaf.size.height
  cropModal.fitMode = leaf.fitMode
  cropModal.initialCrop = {
    cropX: existing?.cropX ?? 0,
    cropY: existing?.cropY ?? 0,
    imageScale: existing?.imageScale ?? 1,
  }
  cropModal.open = true
}

function closeCropEditor(): void {
  cropModal.open = false
}

async function handleCropSave(crop: PhotoCropState): Promise<void> {
  if (!cropModal.journalPageId || !cropModal.elementId || !cropModal.imageUrl) {
    return
  }

  cropModal.saving = true
  try {
    await store.savePlaceholders(cropModal.journalPageId, [
      {
        elementId: cropModal.elementId,
        valueType: 'PHOTO',
        jsonValue: {
          url: cropModal.imageUrl,
          cropX: crop.cropX,
          cropY: crop.cropY,
          imageScale: crop.imageScale,
        },
      },
    ])
    cropModal.open = false
  } catch {
    // orderError is set in the store; keep the modal open so the user can retry.
  } finally {
    cropModal.saving = false
  }
}

async function removePhoto(photo: GalleryPhoto): Promise<void> {
  const previous = photos.value
  photos.value = photos.value.filter((item) => item.id !== photo.id)
  try {
    await photoGalleryApi.remove(photo.id, galleryScope.value)
  } catch {
    photos.value = previous
  }
}

function goToPreviousStep(): void {
  void router.push({ name: 'create-order' })
}

const incompletePhotosModalOpen = ref(false)

function goToNextStep(): void {
  const incompletePages = collectPhotoSlotPreview(store.order?.journalPages ?? [])
  const hasEmptySlots = incompletePages.some((page) => page.slots.some((slot) => !slot.url))
  if (hasEmptySlots) {
    incompletePhotosModalOpen.value = true
    return
  }
  void router.push({ name: 'order-questionnaire', params: { orderId: orderId.value } })
}

/** "Загружу позже" — the anketa step still gates on this via its own `finish()` check (see
 * QuestionnairePage.vue/MissingPhotosModal.vue), so leaving photos incomplete here is a deferral,
 * not a way to skip filling them entirely. */
function continueWithoutPhotos(): void {
  incompletePhotosModalOpen.value = false
  void router.push({ name: 'order-questionnaire', params: { orderId: orderId.value } })
}

onMounted(() => {
  void load()

  mobileMediaQuery = window.matchMedia('(max-width: 767px)')
  updateIsMobileViewport()
  mobileMediaQuery.addEventListener('change', updateIsMobileViewport)
})

onBeforeUnmount(() => {
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  mobileMediaQuery?.removeEventListener('change', updateIsMobileViewport)
  stopTouchDragTracking()
})
</script>

<style scoped lang="scss">
.photo-upload-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: calc(100vh - 64px);
  color: $text-secondary;
  text-align: center;
}

.photo-upload-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-elevated;
}

// ── Top bar — copied from QuestionnairePage.vue's .questionnaire-page__topbar ────────────────
.photo-upload-page__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  flex-shrink: 0;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;

  @include mobile-only {
    height: 44px;
  }
}

.photo-upload-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

// Overall progress through the 5-step order-creation flow (not this step's own photo-fill
// progress — see .photo-upload-page__progress further down for that).
.photo-upload-page__step-progress {
  flex-shrink: 0;

  // Superseded by .photo-upload-page__stepper below on mobile.
  @include mobile-only {
    display: none;
  }
}

// ── Mobile stepper — desktop keeps the thin .photo-upload-page__step-progress bar instead ──────
.photo-upload-page__stepper {
  display: none;

  @include mobile-only {
    display: flex;
    align-items: flex-start;
    list-style: none;
    margin: 0;
    padding: $spacing-2 $spacing-4 6px;
    background: $bg-primary;
    border-bottom: 1px solid $border-light;
  }
}

.photo-upload-page__stepper-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;

  // Connecting line to the NEXT item, through the middle of the row of nodes — drawn on every
  // item except the last, sitting behind the node circles (z-index below).
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 9px;
    left: calc(50% + 11px);
    right: calc(-50% + 11px);
    height: 1px;
    background: $border-default;
  }

  &--done:not(:last-child)::after {
    background: $accent;
  }
}

.photo-upload-page__stepper-node {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid $border-default;
  background: $bg-elevated;
  color: $text-muted;
  font-size: 9px;
  font-weight: $font-weight-semibold;

  .photo-upload-page__stepper-item--done & {
    border-color: $accent;
    background: $accent;
    color: $white;
  }

  .photo-upload-page__stepper-item--active & {
    border-color: $accent;
    color: $accent;
  }
}

.photo-upload-page__stepper-label {
  font-size: 9px;
  color: $text-muted;
  text-align: center;
  white-space: nowrap;

  .photo-upload-page__stepper-item--active & {
    color: $text-primary;
    font-weight: $font-weight-semibold;
  }

  .photo-upload-page__stepper-item--done & {
    color: $text-secondary;
  }
}

.photo-upload-page__brand {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  letter-spacing: $letter-spacing-subheading;
  color: $text-primary;
  text-decoration: none;
  transition: opacity 200ms;

  &:hover {
    opacity: 0.65;
  }

  @include mobile-only {
    font-size: $font-size-body-sm;
  }
}

.photo-upload-page__steps-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;

  @include mobile-only {
    font-size: $font-size-caption;
  }
}

.photo-upload-page__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.photo-upload-page__steps-sep {
  margin-inline: 2px;
}

// ── Body: 3D book + main — copied from QuestionnairePage.vue's same-named rules ──────────────
.photo-upload-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow-x: hidden;
}

.photo-upload-page__body-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  width: 100%;
  display: flex;
  align-items: stretch;

  @include mobile-only {
    flex-direction: column;
    align-items: stretch;
    // The book column below now holds a FIXED size (see .photo-upload-page__book-column) instead
    // of shrinking to whatever's left — on a short viewport (small phone, landscape, a keyboard
    // eating screen space, etc.) the column stack no longer fits without the book itself shrinking
    // away to nothing. Scrolling here instead keeps the book at its intended size always; this is
    // the scroll container for the whole mobile column stack (not .photo-upload-page__main-scroll,
    // which only exists for the desktop form column split).
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
}

// Mobile-only duplicate of .photo-upload-page__intro (see the template comment) — lets the
// title/subtitle land above the book card in the column stack without moving the "real" intro
// out of .photo-upload-page__main, which would touch the desktop layout.
.photo-upload-page__intro-mobile {
  display: none;

  @include mobile-only {
    display: block;
    flex-shrink: 0;
    padding-top: $spacing-2;
  }
}

.photo-upload-page__book-column {
  position: relative;
  flex: 0 0 54%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-8;
  background: $bg-primary;
  border-right: 1px solid $border-light;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: 100%;
    width: 100vw;
    background: $bg-primary;
  }

  @include mobile-only {
    // A FIXED height (flex: 0 0 <n>, not 1/min-height:0 any more) — the book must never shrink
    // below its intended size just because a short viewport (small phone, landscape, a keyboard
    // eating screen space…) leaves less room: QuestionnaireBook's `fit-height` mode derives the
    // frame from whatever height it's actually given, so a shrinking column used to mean a
    // shrinking, sometimes near-invisible book. Now the ancestor column
    // (.photo-upload-page__body-inner) scrolls instead when the stack doesn't fit — the book always
    // renders at this same size, tall screens included (max-height's old job — capping otherwise-
    // unbounded flex:1 growth — is now just this fixed number directly). 328px is an estimate of
    // the book's own natural height at a typical phone width (this component has no JS-based
    // sizing) — may need retuning against a real device. It accounts for both the frame and the
    // "Изменить порядок"/"Добавить 4 страницы" toolbar row underneath it (see QuestionnaireBook.vue's
    // `show-structure-controls`, on unconditionally below), which share this one fixed height —
    // 280px was the frame alone, padded up by roughly the toolbar row's own height (~4px+4px
    // padding, ~10px/1.4 line-height, ~1.5px border) plus the $spacing-4 gap above it.
    flex: 0 0 328px;
    margin-top: $spacing-2;
    padding: $spacing-3;
    border: none;
    border-radius: 16px;
    // Paler than $accent-tint (#fbdfe9) — matches the soft blush background behind the book in
    // the reference design more closely than the more saturated shared accent-tint token does.
    background: #fdf0f3;

    &::before {
      display: none;
    }
  }
}

// ── Mobile-only page hint row, right below the book card ────────────────────────────────────
// Replaces QuestionnaireBook's own built-in prev/next + "N из M" row on mobile (see `hide-nav`
// on the <QuestionnaireBook> usage below) with this hand-icon hint + pill counter instead —
// desktop keeps the built-in one, unchanged.
.photo-upload-page__book-hint {
  display: none;

  @include mobile-only {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: $spacing-2;
    margin-top: $spacing-2;
    padding: $spacing-2;
    border-radius: $radius-md;
    background: $bg-tertiary;
  }
}

.photo-upload-page__book-hint-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  background: $accent-tint;
  color: $accent-deep;
}

.photo-upload-page__book-hint-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  color: $text-secondary;
}

.photo-upload-page__book-hint-counter {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 9999px;
  background: $bg-elevated;
  color: $text-secondary;
  font-size: 9px;
  white-space: nowrap;
}

// ── Mobile-only round prev/next arrows over the book, same as the reference design — desktop
// keeps QuestionnaireBook's own built-in arrows (only hidden on mobile via hide-nav). ───────────
.photo-upload-page__book-arrow {
  display: none;

  @include mobile-only {
    display: flex;
    position: absolute;
    top: 50%;
    z-index: 2;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    transform: translateY(-50%);
    border: none;
    border-radius: 50%;
    background: $bg-elevated;
    color: $text-primary;
    box-shadow: 0 2px 8px rgba($black, 0.16);
    cursor: pointer;
    transition: opacity 150ms ease;

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
}

.photo-upload-page__book-arrow--prev {
  @include mobile-only {
    left: 6px;
  }
}

.photo-upload-page__book-arrow--next {
  @include mobile-only {
    right: 6px;
  }
}

.photo-upload-page__main {
  position: relative;
  flex: 1;
  min-height: 0;
  background: $bg-elevated;

  // On mobile, .photo-upload-page__body-inner itself scrolls (a single column stack) instead of
  // this having its own inner scroll region next to a fixed book column — flex:1/min-height:0 are
  // row-layout-only sizing, and left in place here would collapse this to zero height.
  @include mobile-only {
    flex: 0 0 auto;
    min-height: auto;

    // The full-bleed trick below only makes sense in the desktop row split (book column | form
    // column, each bleeding into the outer gutter on their own side) — in the mobile column stack
    // there's no "other side" to bleed past, and it was the source of a phantom scrollable area.
    &::after {
      display: none;
    }
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 100%;
    width: 100vw;
    background: $bg-elevated;
  }
}

.photo-upload-page__main-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-block: $spacing-8 $spacing-12;
  padding-inline: $spacing-6;

  // .photo-upload-page__body-inner is the scroll container on mobile (see .photo-upload-page__main
  // above) — this just becomes a normal block within it instead of a second, nested scroll region.
  // The bottom action bar is a normal flex row below .photo-upload-page__body (not fixed/overlaid),
  // so — unlike a fixed-footer page — this needs no extra bottom padding to clear it; a large value
  // here left dead, scrollable empty space below the actual content.
  @include mobile-only {
    height: auto;
    overflow: visible;
    padding: 0;
  }
}

.photo-upload-page__container {
  max-width: 480px;
  margin-inline: auto;
  width: 100%;
}

.photo-upload-page__intro {
  margin-bottom: $spacing-6;

  // Superseded by .photo-upload-page__intro-mobile above the book card — see the template comment.
  @include mobile-only {
    display: none;
  }
}

.photo-upload-page__eyebrow {
  margin: 0 0 $spacing-2;
}

.photo-upload-page__title {
  margin: 0 0 $spacing-3;

  // Shared with the mobile-only duplicate intro above the book card — the desktop instance never
  // sees this (hidden via .photo-upload-page__intro's own mobile-only display:none).
  @include mobile-only {
    margin-bottom: $spacing-1;
    // Bold + $font-size-h4 (24px) — back near the reference design's own title weight/size after
    // 10px (an earlier "40% smaller" request) turned out too small once this rule actually started
    // applying (see the !important note below). !important because the "text-h3" utility class on
    // the same <h1> (Unbounded, 32px, regular weight, unconditional) otherwise wins on mobile
    // despite this rule compiling after it.
    font-size: $font-size-h4 !important;
    font-weight: $font-weight-bold !important;
    line-height: 1.15 !important;
  }
}

.photo-upload-page__subtitle {
  max-width: 480px;
  margin: 0;

  @include mobile-only {
    font-size: $font-size-caption !important;
    line-height: 1.3;
    // No longer clamped to 2 lines (on request — was cutting the description off). The book card
    // below still never scrolls off-screen regardless of how tall this ends up: it's `flex: 1` in
    // a fixed-height column (see .photo-upload-page__book-column), so it just shrinks to absorb
    // whatever space a longer description takes here instead.
  }
}

// ── Dropzone ───────────────────────────────────────────────────────────────────────────────
.photo-upload-page__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  padding: $spacing-6 $spacing-4;
  border: 1.5px dashed $border-default;
  border-radius: $radius-lg;
  background: $bg-tertiary;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover,
  &--active {
    border-color: $accent;
    background: $accent-tint;
  }

  // Superseded by the "+" tile at the start of the photo row on mobile — see
  // .photo-upload-page__add-tile.
  @include mobile-only {
    display: none;
  }
}

.photo-upload-page__file-input {
  display: none;
}

.photo-upload-page__dropzone-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: $spacing-1;
  border-radius: 50%;
  border: 1.5px solid $border-default;
  background: $bg-elevated;
  color: $text-secondary;
}

.photo-upload-page__dropzone-title {
  margin: 0;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.photo-upload-page__dropzone-hint {
  margin: 0;
}

.photo-upload-page__stats {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-3;
  margin-top: $spacing-4;

  @include mobile-only {
    display: none;
  }
}

.photo-upload-page__stats-count {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

// ── Mobile-only "Ваши фотографии" progress — see .photo-upload-page__stats above (desktop) ────
.photo-upload-page__mobile-stats {
  display: none;

  @include mobile-only {
    display: block;
    margin-top: $spacing-2;
  }
}

.photo-upload-page__mobile-stats-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-2;
  margin-bottom: 4px;
}

.photo-upload-page__mobile-stats-title {
  font-size: $font-size-caption;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.photo-upload-page__mobile-stats-count {
  font-size: 10px;
  color: $text-secondary;
  white-space: nowrap;
}

// ── Cover photo picker ────────────────────────────────────────────────────────────────────
.photo-upload-page__cover {
  margin-top: $spacing-4;
  padding-top: $spacing-4;
  border-top: 1px solid $border-light;

  @include mobile-only {
    margin-top: $spacing-2;
    padding-top: 0;
    border-top: none;
  }
}

.photo-upload-page__cover-title {
  margin: 0 0 $spacing-3;
  font-weight: $font-weight-semibold;
  color: $text-primary;

  // Same size as .photo-upload-page__mobile-stats-title ("Ваши фотографии"), on request.
  @include mobile-only {
    margin-bottom: $spacing-2;
    font-size: $font-size-caption;
  }
}

.photo-upload-page__cover-slots {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4;

  @include mobile-only {
    gap: $spacing-3;
  }
}

.photo-upload-page__cover-slot {
  display: flex;
  align-items: center;
  gap: $spacing-3;

  @include mobile-only {
    gap: $spacing-2;

    .v-btn {
      height: 24px;
      padding-inline: 8px;
      font-size: 10px;

      :deep(.v-btn__content) {
        font-size: 10px;
      }
    }
  }
}

.photo-upload-page__cover-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;

  @include mobile-only {
    width: 44px;
    height: 44px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

// ── Uploaded grid ──────────────────────────────────────────────────────────────────────────
.photo-upload-page__grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  margin-top: $spacing-4;

  // Its only content is the "Расставить вручную"/"Готово" toggle — moot on mobile, where manual
  // placement is always on (see isMobileViewport/manualPlacementMode).
  @include mobile-only {
    display: none;
  }
}

.photo-upload-page__manual-hint {
  margin: $spacing-1 0 0;

  @include mobile-only {
    display: none;
  }
}

.photo-upload-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: $spacing-2;
  margin-top: $spacing-3;

  // On mobile this becomes a row with a fixed "+" tile followed by the scrollable photos (see
  // .photo-upload-page__thumbs-scroll) — only the photos scroll, the "+" tile stays put.
  @include mobile-only {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid $border-light;
  }
}

// Mobile-only — first tile in the row, replaces the (hidden) dropzone as the way to add photos.
// Sits OUTSIDE .photo-upload-page__thumbs-scroll so it never scrolls away with the photos.
.photo-upload-page__add-tile {
  display: none;

  @include mobile-only {
    display: flex;
    flex: 0 0 56px;
    width: 56px;
    height: 56px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 2px;
    border: 1.5px dashed $accent;
    border-radius: 0;
    background: $white;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease;

    &:hover,
    &:active {
      border-color: $accent-deep;
      background: $accent-tint;
    }
  }
}

.photo-upload-page__add-tile-label {
  font-size: 8px;
  line-height: 1.15;
  color: $accent-deep;
  text-align: center;
}

// On desktop this is inert (`display: contents` — its .photo-upload-page__thumb children stay
// direct grid items of .photo-upload-page__grid, same as before this wrapper existed). On mobile
// it becomes the actual horizontally-scrolling area — see item 3 of the mobile spec: scrolling
// browses the uploaded photos only, not the "+" tile beside them.
.photo-upload-page__thumbs-scroll {
  display: contents;

  @include mobile-only {
    display: flex;
    gap: $spacing-3;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.photo-upload-page__thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;
  // Desktop: lets a swipe on the thumb keep scrolling the row (dragging there uses HTML5 DnD via
  // @dragstart instead, which doesn't need touch-action at all).
  touch-action: pan-x;

  @include mobile-only {
    flex: 0 0 56px;
    width: 56px;
    height: 56px;
    // The whole thumb starts a touch-drag directly now (on request — see handleThumbPointerDown;
    // there used to be a small dedicated drag-handle icon instead, which is what pan-x above was
    // originally carved out for). `none` is what makes that drag-start reliable — with pan-x here,
    // the browser can commit the gesture to scrolling the row before our own pointer handling gets
    // a chance to preventDefault. Trade-off: swiping a photo no longer scrolls the row — only
    // touching the gaps between thumbs (or the add-tile) does.
    touch-action: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &--draggable {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.photo-upload-page__thumb-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba($black, 0.55);
  color: $white;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: rgba($black, 0.75);
  }

  @include mobile-only {
    width: 16px;
    height: 16px;
  }
}

// Shows how many places in the journal already use this photo — click jumps straight there (one
// use) or opens the full list (more than one) — see `handleUsageClick`. Red once it's used more
// than twice, as a nudge that the same photo is getting spread pretty thin across the journal.
.photo-upload-page__thumb-usage {
  position: absolute;
  bottom: 3px;
  left: 3px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  border: none;
  background: rgba($black, 0.6);
  color: $white;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: rgba($black, 0.8);
  }

  &--multi {
    background: rgba(#e5484d, 0.9);

    &:hover {
      background: #e5484d;
    }
  }

  @include mobile-only {
    height: 14px;
    padding: 0 4px;
    font-size: 8px;
  }
}

// ── Action bar — copied from QuestionnairePage.vue's .questionnaire-page__actions ────────────
.photo-upload-page__actions {
  position: relative;
  flex-shrink: 0;
  background: rgba($bg-elevated, 0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid $border-light;
  padding-block: $spacing-4;

  @include mobile-only {
    padding-block: $spacing-2;
  }
}

.photo-upload-page__actions-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.photo-upload-page__btn-back {
  min-width: 120px;
  letter-spacing: $letter-spacing-button;
  border-color: $border-default !important;
  text-transform: none;

  @include mobile-only {
    min-width: 96px;
  }
}

.photo-upload-page__btn-next {
  min-width: 180px;
  letter-spacing: $letter-spacing-button;
  text-transform: none;

  @include mobile-only {
    min-width: 140px;
  }
}

// ── Usage modal ────────────────────────────────────────────────────────────────────────────
.photo-upload-page__usage-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.photo-upload-page__usage-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.photo-upload-page__usage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: $spacing-3 0;
  border: none;
  border-bottom: 1px solid $border-light;
  background: none;
  color: $text-primary;
  font-size: $font-size-body;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: $accent;
  }
}

.photo-upload-page__usage-list li:last-child .photo-upload-page__usage-item {
  border-bottom: none;
}

// ── Incomplete-photos confirm modal ───────────────────────────────────────────────────────────
// Same visual language as MissingContentModal.vue's own BaseModal-based notice (icon circle,
// centered title/subtitle, full-width stacked actions) — kept as its own local style here since
// this modal's copy/actions are specific to Шаг 2 and it's used from nowhere else.
.photo-upload-page__incomplete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  width: min(100%, 400px);
  margin-inline: auto;
  padding-top: $spacing-2;
  text-align: center;
}

.photo-upload-page__incomplete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background: $accent;
}

.photo-upload-page__incomplete-title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.photo-upload-page__incomplete-subtitle {
  margin: 0;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
}

.photo-upload-page__incomplete-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  width: 100%;
  margin-top: $spacing-2;

  .v-btn {
    text-transform: none;
  }
}

// ── Touch drag ghost — see handleThumbHandlePointerDown ───────────────────────────────────────
.photo-upload-page__drag-ghost {
  position: fixed;
  z-index: 200;
  width: 64px;
  height: 64px;
  pointer-events: none;
  border-radius: $radius-md;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba($black, 0.28);
  transform: translate(-50%, -50%) scale(1.08);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
</style>
