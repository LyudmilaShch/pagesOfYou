<template>
  <div v-if="isLoading" class="journal-review-page__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка…</p>
  </div>

  <div v-else-if="loadErrorMessage" class="journal-review-page__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadErrorMessage }}</p>
    <v-btn variant="outlined" :to="{ name: 'create-order' }">Начать заново</v-btn>
  </div>

  <div v-else class="journal-review-page">

    <!-- ── Top navigation bar — same chrome as the other order-creation steps ───────────────── -->
    <header class="journal-review-page__topbar">
      <div class="journal-review-page__topbar-inner">
        <router-link to="/" class="journal-review-page__brand">Вау, ми!</router-link>

        <div class="journal-review-page__steps-label" aria-label="Шаг 4 из 5">
          <span class="journal-review-page__steps-current">4</span>
          <span class="journal-review-page__steps-sep">/</span>
          <span class="journal-review-page__steps-total">5</span>
        </div>
      </div>
    </header>

    <!-- ── Body: the book, centred, at its largest size — no side panel on this step ────────── -->
    <main class="journal-review-page__main">
      <div class="journal-review-page__container">
        <header class="journal-review-page__intro">
          <p class="journal-review-page__eyebrow text-caption text-secondary">Шаг 4 — Проверка</p>
          <h1 class="journal-review-page__title text-h2">Ваш журнал готов!</h1>
          <p class="journal-review-page__subtitle text-body text-secondary">
            Взгляните перед заказом — текст и фото можно поправить прямо здесь
          </p>
        </header>

        <div class="journal-review-page__book-wrap" aria-label="Развороты журнала">
          <QuestionnaireBook
            :pages="store.order?.journalPages ?? []"
            :canvas-data-by-page-id="canvasDataByPageId"
            :focus-page-id="null"
            :pulsing-page-ids="EMPTY_PAGE_IDS"
            :fill-by-page-id="EMPTY_FILL_MAP"
            :pending-element-ids="EMPTY_ELEMENT_IDS"
            :drop-enabled="false"
            :fit-height="isDesktopViewport"
            crop-enabled
            pick-enabled
            ai-text-edit-enabled
            @crop-photo="openCropEditor"
            @pick-photo="openPhotoPicker"
            @edit-ai-text="openAiTextEditor"
            @regenerate-ai-text="handleRegenerateAiText"
          />
        </div>
      </div>
    </main>

    <!-- ── Bottom action bar — same chrome as the other order-creation steps ────────────────── -->
    <footer class="journal-review-page__actions">
      <div class="journal-review-page__actions-inner">
        <v-btn
          variant="outlined"
          size="large"
          color="primary"
          class="journal-review-page__btn-back"
          @click="goToPreviousStep"
        >
          Назад
        </v-btn>

        <div class="journal-review-page__actions-right">
          <span v-if="missingPhotoCount > 0" class="journal-review-page__missing-photos-pill">
            <v-icon size="16">mdi-alert-outline</v-icon>
            Не хватает {{ missingPhotoCount }} фото
          </span>

          <v-btn
            color="primary"
            size="large"
            class="journal-review-page__btn-next"
            :loading="isSubmitting"
            @click="finish"
          >
            Оформить заказ
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </div>
      </div>
    </footer>

    <AuthModal
      :open="authModalState.open"
      message="Чтобы оформить заказ, войдите в аккаунт"
      @success="handleAuthSuccess"
      @close="handleAuthClose"
    />

    <v-snackbar :model-value="submitErrorMessage !== null" color="error" @update:model-value="submitErrorMessage = null">
      {{ submitErrorMessage }}
    </v-snackbar>

    <MissingPhotosModal
      :open="missingPhotosModalOpen"
      @close="missingPhotosModalOpen = false"
      @continue="continueAfterPhotosFilled"
    />

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

    <PhotoGalleryPickerDialog
      :open="pickerTarget !== null"
      :scope="galleryScope"
      @select="handlePickerSelect"
      @close="closePhotoPicker"
    />

    <AiTextEditModal
      :open="aiTextEditModal.open"
      :initial-text="aiTextEditModal.initialText"
      :length-constraint="aiTextEditModal.lengthConstraint"
      :loading="aiTextEditModal.saving"
      @close="closeAiTextEditor"
      @save="saveAiTextEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isAiTextElement, isPhotoElement } from '@/modules/editor/models'
import type { AiTextPlaceholder, LengthConstraint, PhotoFitMode } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import type { PhotoCropState } from '@/modules/editor/utils/photo-crop.util'
import { useAuthStore } from '@/stores/auth.store'
import AuthModal from '@/components/auth/AuthModal.vue'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { collectPhotoSlotPreview, countEmptyPhotoSlots } from '../utils/missing-photos.util'
import QuestionnaireBook from '../components/questionnaire/QuestionnaireBook.vue'
import MissingPhotosModal from '../components/MissingPhotosModal.vue'
import PhotoCropModal from '../components/PhotoCropModal.vue'
import PhotoGalleryPickerDialog from '../components/PhotoGalleryPickerDialog.vue'
import AiTextEditModal from '../components/AiTextEditModal.vue'

// Stable empty instances — QuestionnaireBook's fill-badge/pulse/pending-AI props don't apply on
// this read-mostly review step, but they aren't optional props (same reasoning as
// PhotoUploadPage.vue/MissingPhotosModal.vue's own identical comment).
const EMPTY_PAGE_IDS: Set<string> = new Set()
const EMPTY_FILL_MAP: Map<string, { answered: number; total: number }> = new Map()
const EMPTY_ELEMENT_IDS: Set<string> = new Set()

const route = useRoute()
const router = useRouter()
const store = useOrderBuilderStore()
const authStore = useAuthStore()

const orderId = computed(() => route.params.orderId as string)
const galleryScope = computed(() => getGalleryScope(store))

const isLoading = ref(true)
const loadErrorMessage = ref<string | null>(null)

/** Mirrors PhotoUploadPage.vue's/QuestionnairePage.vue's own ensureOrderLoaded 1-1: a local draft
 * only exists once the user has already gone through CreateOrderPage in this session — a cold URL
 * hit for a guest has nothing to load. */
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
  } catch (err: unknown) {
    loadErrorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить страницу.'
  } finally {
    isLoading.value = false
  }
}

const canvasDataByPageId = computed(() => {
  const map = new Map<string, ReturnType<typeof materializeCanvasData>>()
  for (const page of store.order?.journalPages ?? []) {
    map.set(page.id, materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues))
  }
  return map
})

const missingPhotoCount = computed(() =>
  countEmptyPhotoSlots(collectPhotoSlotPreview(store.order?.journalPages ?? [])),
)

function goToPreviousStep(): void {
  void router.push({ name: 'order-questionnaire', params: { orderId: orderId.value } })
}

// ---------------------------------------------------------------------------
// Photo crop
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Photo pick / replace — a generic gallery picker for any slot, empty or filled
// ---------------------------------------------------------------------------

const pickerTarget = ref<{ journalPageId: string; elementId: string } | null>(null)

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

// ---------------------------------------------------------------------------
// AI-text manual edit / regenerate
// ---------------------------------------------------------------------------

const aiTextEditModal = reactive<{
  open: boolean
  journalPageId: string | null
  elementId: string | null
  initialText: string
  lengthConstraint: LengthConstraint | null
  saving: boolean
}>({
  open: false,
  journalPageId: null,
  elementId: null,
  initialText: '',
  lengthConstraint: null,
  saving: false,
})

function findAiTextLeaf(journalPageId: string, elementId: string): AiTextPlaceholder | null {
  const canvas = canvasDataByPageId.value.get(journalPageId)
  if (!canvas) {
    return null
  }
  const leaf = flattenTree(canvas.elements).find((item) => item.id === elementId)
  return leaf && isAiTextElement(leaf) ? leaf : null
}

function openAiTextEditor(journalPageId: string, elementId: string): void {
  const leaf = findAiTextLeaf(journalPageId, elementId)
  if (!leaf) {
    return
  }
  aiTextEditModal.journalPageId = journalPageId
  aiTextEditModal.elementId = elementId
  aiTextEditModal.initialText = leaf.previewPlaceholderText ?? ''
  aiTextEditModal.lengthConstraint = leaf.lengthConstraint
  aiTextEditModal.open = true
}

function closeAiTextEditor(): void {
  aiTextEditModal.open = false
}

async function saveAiTextEdit(text: string): Promise<void> {
  if (!aiTextEditModal.journalPageId || !aiTextEditModal.elementId) {
    return
  }

  aiTextEditModal.saving = true
  try {
    await store.savePlaceholders(aiTextEditModal.journalPageId, [
      { elementId: aiTextEditModal.elementId, valueType: 'TEXT', textValue: text },
    ])
    aiTextEditModal.open = false
  } catch {
    // orderError is set in the store — keep the modal open so the user can retry.
  } finally {
    aiTextEditModal.saving = false
  }
}

async function handleRegenerateAiText(journalPageId: string, elementId: string): Promise<void> {
  if (store.isLocalDraft) {
    submitErrorMessage.value = 'Сначала сохраните заказ, чтобы сгенерировать новый вариант текста.'
    return
  }

  try {
    await store.regenerateAiText(journalPageId, elementId)
  } catch {
    submitErrorMessage.value = store.orderError ?? 'Не удалось сгенерировать новый вариант текста.'
  }
}

// ---------------------------------------------------------------------------
// Sign-in bridge + final submit → checkout
// ---------------------------------------------------------------------------

const authModalState = reactive<{ open: boolean; resolve: ((success: boolean) => void) | null }>({
  open: false,
  resolve: null,
})

function requireAuth(): Promise<boolean> {
  if (authStore.isAuthenticated) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    authModalState.resolve = resolve
    authModalState.open = true
  })
}

function handleAuthSuccess(): void {
  authModalState.open = false
  authModalState.resolve?.(true)
  authModalState.resolve = null
}

function handleAuthClose(): void {
  authModalState.open = false
  authModalState.resolve?.(false)
  authModalState.resolve = null
}

const isSubmitting = ref(false)
const submitErrorMessage = ref<string | null>(null)
const missingPhotosModalOpen = ref(false)

/** The last stop before checkout — every gate the questionnaire step used to run right before
 * navigating to checkout now lives here instead, since fixing anything it finds (missing photos,
 * an unfillable required slot) is now possible right on this same page. */
async function finish(): Promise<void> {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  try {
    const missingPhotoPages = collectPhotoSlotPreview(store.order?.journalPages ?? [])
    if (missingPhotoPages.some((page) => page.slots.some((slot) => !slot.url))) {
      missingPhotosModalOpen.value = true
      return
    }

    // The advanced per-element editor is no longer something a customer can be sent to — this is
    // the only remaining gap it used to catch (a required text slot with no questionKey of its
    // own, so nothing tracks it directly). Surface it in place and let the user go back a step.
    if (store.getSubmitValidationError()) {
      submitErrorMessage.value =
        'Не хватает содержимого для обязательных мест в журнале. Вернитесь на предыдущий шаг и ' +
        'заполните их, затем попробуйте снова.'
      return
    }

    // Checkout is a real backend order's page (`requiresAuth`) — a guest's local draft has to
    // become one first, same as JournalPageEditorPage.vue's own "Оформить заказ" flow.
    if (store.isLocalDraft) {
      const authenticated = await requireAuth()
      if (!authenticated) {
        return
      }
      await store.convertLocalDraftToOrder()
    }

    if (!store.order) {
      return
    }
    await router.push({ name: 'order-checkout', params: { orderId: store.order.id } })
  } finally {
    isSubmitting.value = false
  }
}

/** MissingPhotosModal's own "Продолжить" — only shown once every slot it tracks is filled, so
 * re-running `finish()` here just falls through its now-satisfied photo check onto the rest. */
function continueAfterPhotosFilled(): void {
  missingPhotosModalOpen.value = false
  void finish()
}

// Same threshold as the `tablet-up` SCSS mixin (`$breakpoint-tablet-min: 768px`) — the book only
// gets height-bound (see QuestionnaireBook.vue's `fitHeight` prop) above it, so the page fits one
// screen with no scroll on desktop; below it, the book keeps its normal width-driven sizing and
// the page scrolls like every other step, since there's no room left to shrink it into.
const isDesktopViewport = ref(true)
let desktopMediaQuery: MediaQueryList | null = null

function updateIsDesktopViewport(): void {
  isDesktopViewport.value = desktopMediaQuery?.matches ?? true
}

onMounted(() => {
  void load()

  desktopMediaQuery = window.matchMedia('(min-width: 768px)')
  updateIsDesktopViewport()
  desktopMediaQuery.addEventListener('change', updateIsDesktopViewport)
})

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener('change', updateIsDesktopViewport)
})
</script>

<style scoped lang="scss">
.journal-review-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: 100vh;
  color: $text-secondary;
  text-align: center;
}

.journal-review-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-elevated;

  // Locked to exactly one viewport on desktop (no scroll — see QuestionnaireBook.vue's
  // `fitHeight`, which the book below shrinks into) — mobile keeps the natural min-height/scroll
  // flow above, since there's no spare room left there to shrink the book into instead.
  @include tablet-up {
    height: 100vh;
    overflow: hidden;
  }
}

.journal-review-page__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  flex-shrink: 0;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;
}

.journal-review-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

.journal-review-page__brand {
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
}

.journal-review-page__steps-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
}

.journal-review-page__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.journal-review-page__steps-sep {
  margin-inline: 2px;
}

.journal-review-page__main {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  padding-block: $spacing-8;

  @include mobile-only {
    padding-block: $spacing-6 $spacing-4;
  }

  @include tablet-up {
    align-items: stretch;
    overflow: hidden;
  }
}

.journal-review-page__container {
  @include page-container;
  max-width: 900px;
  margin-inline: auto;
  width: 100%;

  @include tablet-up {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}

.journal-review-page__intro {
  margin-bottom: $spacing-8;
  text-align: center;

  @include mobile-only {
    margin-bottom: $spacing-6;
  }

  @include tablet-up {
    flex-shrink: 0;
    margin-bottom: $spacing-4;
  }
}

.journal-review-page__eyebrow {
  margin: 0 0 $spacing-2;
}

.journal-review-page__title {
  margin: 0 0 $spacing-3;

  // !important — the "text-h2" utility class on the same <h1> (44px, unconditional) otherwise
  // wins over this on mobile despite this rule compiling after it (see PhotoUploadPage.vue's own
  // title rule for the full story).
  @include mobile-only {
    font-size: $font-size-body-lg !important;
    margin-bottom: $spacing-2 !important;
  }
}

.journal-review-page__subtitle {
  max-width: 480px;
  margin-inline: auto;
}

.journal-review-page__book-wrap {
  width: 100%;

  @include tablet-up {
    flex: 1;
    min-height: 0;
    display: flex;
  }
}

.journal-review-page__actions {
  flex-shrink: 0;
  background: rgba($bg-elevated, 0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid $border-light;
  padding-block: $spacing-4;
}

.journal-review-page__actions-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.journal-review-page__btn-back {
  min-width: 120px;
  letter-spacing: $letter-spacing-button;
  border-color: $border-default !important;
  text-transform: none;
}

.journal-review-page__btn-next {
  min-width: 200px;
  letter-spacing: $letter-spacing-button;
  text-transform: none;
}

.journal-review-page__actions-right {
  display: flex;
  align-items: center;
  gap: $spacing-3;
}

// Deliberately not the theme's `warning` color — see QuestionnairePage.vue's own identical pill.
.journal-review-page__missing-photos-pill {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-2 $spacing-3;
  border-radius: 999px;
  background: #fceada;
  color: #c9762f;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  white-space: nowrap;

  @include mobile-only {
    padding: 4px $spacing-2;
    font-size: $font-size-caption;

    .v-icon {
      display: none;
    }
  }
}
</style>
