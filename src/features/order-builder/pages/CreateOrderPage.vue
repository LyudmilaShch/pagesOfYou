<template>
  <div class="create-order">

    <!-- ── Top navigation bar ─────────────────────────────────────────────── -->
    <header class="create-order__topbar">
      <div class="create-order__topbar-inner">
        <router-link to="/" class="create-order__brand">Вау, ми!</router-link>

        <div class="create-order__steps-label" aria-label="Шаг 1 из 5">
          <span class="create-order__steps-current">1</span>
          <span class="create-order__steps-sep">/</span>
          <span class="create-order__steps-total">5</span>
        </div>
      </div>
    </header>

    <!-- Mobile-only stepper — same 5 steps as .create-order__steps-label above, just a fuller
         visual (desktop keeps the thin "1/5" text instead). This page is always step 1 — every
         other step is "ahead", clickable only once its own content is actually ready (see
         `isStepReachable`), e.g. after resuming a draft that already has photos/answers filled in. -->
    <ol class="create-order__stepper" aria-label="Шаг 1 из 5: Журнал">
      <li
        v-for="step in ORDER_STEPS"
        :key="step.step"
        class="create-order__stepper-item"
        :class="{
          'create-order__stepper-item--active': step.step === 1,
          'create-order__stepper-item--reachable': step.step !== 1 && isStepReachable(step.step),
        }"
      >
        <button
          v-if="step.step !== 1 && isStepReachable(step.step)"
          type="button"
          class="create-order__stepper-btn"
          :aria-label="`Перейти к шагу «${step.label}»`"
          @click="goToStep(step.step)"
        >
          <span class="create-order__stepper-node">{{ step.step }}</span>
          <span class="create-order__stepper-label">{{ step.label }}</span>
        </button>
        <template v-else>
          <span class="create-order__stepper-node">{{ step.step }}</span>
          <span class="create-order__stepper-label">{{ step.label }}</span>
        </template>
      </li>
    </ol>

    <!-- ── Main content ───────────────────────────────────────────────────── -->
    <main class="create-order__main">
      <div class="create-order__container">

        <!-- Section heading -->
        <header class="create-order__intro">
          <p class="create-order__eyebrow text-caption text-secondary">Шаг 1 — Тип журнала</p>
          <h1 class="create-order__title text-h2">Выберите журнал</h1>
          <p class="create-order__subtitle text-body-lg text-secondary">
            Для кого вы хотите создать особенный журнал?
          </p>
        </header>

        <!-- Error state -->
        <div v-if="store.loadError || store.orderError" class="create-order__error">
          <v-alert
            v-if="store.loadError"
            type="error"
            variant="tonal"
            rounded="lg"
            class="mb-6"
          >
            {{ store.loadError }}
            <template #append>
              <v-btn
                variant="text"
                size="small"
                :loading="store.isLoadingTypes"
                @click="store.fetchMagazineTypes"
              >
                Повторить
              </v-btn>
            </template>
          </v-alert>

          <v-alert
            v-if="store.orderError"
            type="error"
            variant="tonal"
            rounded="lg"
            class="mb-6"
          >
            {{ store.orderError }}
          </v-alert>
        </div>

        <!-- Skeleton loader while fetching -->
        <div v-if="store.isLoadingTypes" class="create-order__grid" aria-busy="true">
          <div
            v-for="n in 5"
            :key="n"
            class="create-order__skeleton"
            role="presentation"
          />
        </div>

        <!-- Magazine type grid -->
        <div
          v-else-if="store.magazineTypes.length"
          class="create-order__grid"
          role="radiogroup"
          aria-label="Тип журнала"
        >
          <MagazineTypeCard
            v-for="type in store.magazineTypes"
            :key="type.id"
            :type="type"
            :is-selected="store.selectedMagazineType?.id === type.id"
            @select="store.selectMagazineType"
          />
        </div>
      </div>
    </main>

    <!-- ── Bottom action bar ──────────────────────────────────────────────── -->
    <footer class="create-order__actions">
      <div class="create-order__actions-inner">
        <v-btn
          variant="outlined"
          size="large"
          color="primary"
          class="create-order__btn-back"
          :to="{ path: '/' }"
        >
          Назад
        </v-btn>

        <v-btn
          color="primary"
          size="large"
          class="create-order__btn-next"
          :disabled="!store.selectedMagazineType || store.isLoadingOrder || checkingDrafts"
          :loading="store.isLoadingOrder"
          @click="handleNext"
        >
          Продолжить
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
      </div>
    </footer>

    <ResumeDraftModal
      :open="resumeModal.open"
      :mode="resumeModal.mode"
      :drafts="resumeModal.drafts"
      :guest-draft="resumeModal.guestDraft"
      @continue="onResumeContinue"
      @start-new="onResumeStartNew"
      @close="resumeModal.open = false"
    />

    <LoadingModal :model-value="navigatingNext" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'
import { ordersApi } from '../api/orders.api'
import type { OrderSummary } from '../types/order.types'
import { clearLocalDraft, readLocalDraft, type StoredLocalDraft } from '../utils/local-draft-storage.util'
import { resolveResumeRoute, resumeOrder } from '../utils/resume-order.util'
import { collectPhotoSlotPreview } from '../utils/missing-photos.util'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import MagazineTypeCard from '../components/MagazineTypeCard.vue'
import ResumeDraftModal from '../components/ResumeDraftModal.vue'
import LoadingModal from '@/components/ui/LoadingModal.vue'

const store = useOrderBuilderStore()
const authStore = useAuthStore()
const router = useRouter()

// Mobile stepper labels — same list/pattern as PhotoUploadPage.vue's own ORDER_STEPS (see its doc
// comment); duplicated per page rather than shared since each page is always exactly one fixed step.
const ORDER_STEPS = [
  { step: 1, label: 'Журнал' },
  { step: 2, label: 'Фото' },
  { step: 3, label: 'Анкета' },
  { step: 4, label: 'Проверка' },
  { step: 5, label: 'Оплата' },
]

// Whether every photo slot in the journal is filled — the same check PhotoUploadPage.vue's own
// "Продолжить" uses, reused here (and on every later step's own stepper) to decide whether the
// mobile stepper's Анкета step is safe to jump to directly, without visiting Фото first.
const photosComplete = computed(() => {
  const pages = store.order?.journalPages ?? []
  return pages.length > 0 && !collectPhotoSlotPreview(pages).some((page) => page.slots.some((slot) => !slot.url))
})

// Whether every required placeholder in the journal (photo AND text/AI-text) is filled — the same
// client-side check `getSubmitValidationError` runs before checkout, reused here to decide whether
// the mobile stepper's Проверка/Оплата steps are safe to jump to directly.
const contentComplete = computed(() => store.order != null && store.getSubmitValidationError() === null)

/** Gates the mobile stepper's click-to-jump for a step AHEAD of the one this page is on (backward
 * jumps are always allowed elsewhere — this page has none, since it's always step 1) — a step
 * only becomes clickable once its own prerequisite content actually exists, so jumping ahead can
 * never land on a broken/empty page. */
function isStepReachable(step: number): boolean {
  if (step === 2) {
    return store.order != null
  }
  if (step === 3) {
    return photosComplete.value
  }
  if (step === 4 || step === 5) {
    return contentComplete.value
  }
  return false
}

function goToStep(step: number): void {
  if (step === 2 && store.order) {
    void router.push({ name: 'order-photo-upload', params: { orderId: store.order.id } })
  } else if (step === 3 && store.order) {
    void router.push({ name: 'order-questionnaire', params: { orderId: store.order.id } })
  } else if (step === 4 && store.order) {
    void router.push({ name: 'order-review', params: { orderId: store.order.id } })
  } else if (step === 5 && store.order) {
    void router.push({ name: 'order-checkout', params: { orderId: store.order.id } })
  }
}

const checkingDrafts = ref(true)
const resumeModal = reactive<{
  open: boolean
  mode: 'authenticated' | 'guest'
  drafts: OrderSummary[]
  guestDraft: StoredLocalDraft | null
}>({
  open: false,
  mode: 'authenticated',
  drafts: [],
  guestDraft: null,
})

onMounted(async () => {
  store.orderError = null
  store.fetchMagazineTypes()
  await checkForDrafts()
})

/** Runs once on mount — offers to resume an in-progress journal instead of always starting fresh.
 * Also adopts a guest's leftover localStorage draft into a real order if the user is already
 * signed in (e.g. they logged in via the header in another tab) — otherwise that draft would keep
 * silently existing without ever surfacing as one of their real "Мои журналы" drafts. */
async function checkForDrafts(): Promise<void> {
  checkingDrafts.value = true

  try {
    const guestDraft = readLocalDraft()

    if (authStore.isAuthenticated) {
      if (guestDraft) {
        try {
          await store.restoreLocalDraft(guestDraft)
          await store.convertLocalDraftToOrder()
        } catch {
          // Best-effort adoption — if it fails, fall through to the normal drafts check below;
          // the guest draft stays in localStorage and nothing is lost.
        }
      }

      const result = await ordersApi.list()
      const drafts = result.items.filter((order) => order.status === 'DRAFT')
      if (drafts.length > 0) {
        resumeModal.mode = 'authenticated'
        resumeModal.drafts = drafts
        resumeModal.open = true
      }
    } else if (guestDraft) {
      resumeModal.mode = 'guest'
      resumeModal.guestDraft = guestDraft
      resumeModal.open = true
    }
  } finally {
    checkingDrafts.value = false
  }
}

async function onResumeContinue(orderId?: string): Promise<void> {
  resumeModal.open = false
  store.orderError = null

  try {
    if (resumeModal.mode === 'authenticated' && orderId) {
      await resumeOrder(router, orderId)
    } else if (resumeModal.mode === 'guest' && resumeModal.guestDraft) {
      await store.restoreLocalDraft(resumeModal.guestDraft)
      const target = store.order ? resolveResumeRoute(store.order) : null
      if (target) {
        await router.push(target)
      }
    }
  } catch {
    store.orderError = 'Не удалось открыть черновик.'
  }
}

function onResumeStartNew(): void {
  resumeModal.open = false
  if (resumeModal.mode === 'guest') {
    clearLocalDraft()
  }
}

// Covers the whole operation, not just `store.isLoadingOrder` (which the button's own :loading
// already reflects) — that resets to false once startDraft resolves, before the router.push
// (and its async route-chunk load) below even starts, so it alone would let the loading modal
// disappear too early, mid-transition.
const navigatingNext = ref(false)

async function handleNext(): Promise<void> {
  if (!store.selectedMagazineType) {
    return
  }

  store.orderError = null
  navigatingNext.value = true

  try {
    await store.startDraft(store.selectedMagazineType.id)

    if (!store.order) {
      return
    }

    await router.push({
      name: 'order-photo-upload',
      params: { orderId: store.order.id },
    })
  } catch {
    // orderError is set in the store
  } finally {
    navigatingNext.value = false
  }
}
</script>

<style scoped lang="scss">
// ── Page layout ──────────────────────────────────────────────────────────────
.create-order {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-primary;
}

// ── Top bar ───────────────────────────────────────────────────────────────────
.create-order__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;

  @include mobile-only {
    height: 44px;
  }
}

.create-order__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

.create-order__brand {
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

.create-order__steps-label {
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

.create-order__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.create-order__steps-sep {
  margin-inline: 2px;
}

// ── Mobile stepper — same as QuestionnairePage.vue's own .questionnaire-page__stepper — desktop
// keeps the thin "1/5" text in the topbar instead. This page is always step 1, so no item ever
// gets a --done state (see the template — that class/check-icon branch is simply omitted here). ──
.create-order__stepper {
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

.create-order__stepper-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 9px;
    left: calc(50% + 11px);
    right: calc(-50% + 11px);
    height: 1px;
    background: $border-default;
  }
}

// Wraps a reachable step's node+label so it's clickable (see the template) — reset to blend back
// into the item's own layout, since this is purely an interactivity wrapper, not a visual one.
.create-order__stepper-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;

  &:hover .create-order__stepper-node {
    transform: scale(1.1);
  }
}

.create-order__stepper-node {
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
  transition: transform 150ms ease;

  // Reachable (ahead, but its own content is already ready) gets the same accent outline as
  // active — not the filled/checkmarked --done treatment, since the step hasn't actually been
  // visited yet, just unlocked.
  .create-order__stepper-item--active &,
  .create-order__stepper-item--reachable & {
    border-color: $accent;
    color: $accent;
  }
}

.create-order__stepper-label {
  font-size: 9px;
  color: $text-muted;
  text-align: center;
  white-space: nowrap;

  .create-order__stepper-item--active & {
    color: $text-primary;
    font-weight: $font-weight-semibold;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
.create-order__main {
  flex: 1;
  padding-block: $spacing-12 $spacing-16;

  @include mobile-only {
    padding-block: $spacing-8 160px; // extra space for fixed bottom bar
  }
}

.create-order__container {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
}

// ── Intro ─────────────────────────────────────────────────────────────────────
.create-order__intro {
  margin-bottom: $spacing-16;

  @include mobile-only {
    margin-bottom: $spacing-12;
  }
}

// Superseded by .create-order__stepper on mobile — redundant with it once that's shown (both say
// "step 1 of 5"), same reasoning as QuestionnairePage.vue's own eyebrow removal.
.create-order__eyebrow {
  margin-bottom: $spacing-2;

  @include mobile-only {
    display: none;
  }
}

.create-order__title {
  margin-bottom: $spacing-3;

  // Same treatment as PhotoUploadPage.vue/QuestionnairePage.vue's own title rule — !important
  // because the "text-h2" utility class on the same <h1> (44px, unconditional) otherwise wins on
  // mobile despite this rule compiling after it.
  @include mobile-only {
    font-size: $font-size-h4 !important;
    font-weight: $font-weight-bold !important;
    line-height: 1.15 !important;
    margin-bottom: $spacing-1 !important;
  }
}

.create-order__subtitle {
  max-width: 480px;
  margin: 0;

  @include mobile-only {
    font-size: $font-size-caption !important;
    line-height: 1.3;
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────
.create-order__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $spacing-4;

  @include tablet-up {
    grid-template-columns: repeat(3, 1fr);
  }

  @include desktop-up {
    grid-template-columns: repeat(5, 1fr);
    gap: $spacing-6;
  }
}

// ── Skeleton cards ────────────────────────────────────────────────────────────
.create-order__skeleton {
  border-radius: $radius-md;
  background: $bg-tertiary;
  // 3:4 image + text approximation
  aspect-ratio: 3 / 5.2;
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}

// ── Action bar ────────────────────────────────────────────────────────────────
.create-order__actions {
  background: rgba($bg-elevated, 0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid $border-light;
  padding-block: $spacing-4;

  @include mobile-only {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding-block: $spacing-3;
  }
}

.create-order__actions-inner {
  @include page-container;
  max-width: 1360px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.create-order__btn-back {
  min-width: 120px;
  letter-spacing: $letter-spacing-button;
  border-color: $border-default !important;
  text-transform: none;
}

.create-order__btn-next {
  min-width: 180px;
  letter-spacing: $letter-spacing-button;
  text-transform: none;
}
</style>
