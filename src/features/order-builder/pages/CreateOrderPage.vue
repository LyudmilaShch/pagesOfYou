<template>
  <div class="create-order">

    <!-- ── Top navigation bar ─────────────────────────────────────────────── -->
    <header class="create-order__topbar">
      <div class="create-order__topbar-inner">
        <router-link to="/" class="create-order__brand">Фолио</router-link>

        <div class="create-order__steps-label" aria-label="Шаг 1 из 3">
          <span class="create-order__steps-current">1</span>
          <span class="create-order__steps-sep">/</span>
          <span class="create-order__steps-total">3</span>
        </div>
      </div>
    </header>

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
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'
import { ordersApi } from '../api/orders.api'
import type { OrderSummary } from '../types/order.types'
import { clearLocalDraft, readLocalDraft, type StoredLocalDraft } from '../utils/local-draft-storage.util'
import { resumeOrder } from '../utils/resume-order.util'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import MagazineTypeCard from '../components/MagazineTypeCard.vue'
import ResumeDraftModal from '../components/ResumeDraftModal.vue'

const store = useOrderBuilderStore()
const authStore = useAuthStore()
const router = useRouter()

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
      const firstPage = store.order?.journalPages[0]
      if (store.order && firstPage) {
        await router.push({
          name: 'journal-page-editor',
          params: { orderId: store.order.id, journalPageId: firstPage.id },
        })
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

async function handleNext(): Promise<void> {
  if (!store.selectedMagazineType) {
    return
  }

  store.orderError = null

  try {
    await store.startDraft(store.selectedMagazineType.id)

    const firstPage = store.order?.journalPages[0]
    if (!store.order || !firstPage) {
      return
    }

    await router.push({
      name: 'journal-page-editor',
      params: { orderId: store.order.id, journalPageId: firstPage.id },
    })
  } catch {
    // orderError is set in the store
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
}

.create-order__steps-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
}

.create-order__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.create-order__steps-sep {
  margin-inline: 2px;
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
  margin-bottom: $spacing-12;

  @include mobile-only {
    margin-bottom: $spacing-8;
  }
}

.create-order__eyebrow {
  margin-bottom: $spacing-2;
}

.create-order__title {
  margin-bottom: $spacing-3;
}

.create-order__subtitle {
  max-width: 480px;
  margin: 0;
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
