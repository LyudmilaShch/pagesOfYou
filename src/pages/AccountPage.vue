<template>
  <div class="account-page">
    <!-- ── Top navigation bar ─────────────────────────────────────────────── -->
    <header class="account-page__topbar">
      <div class="account-page__topbar-inner">
        <router-link to="/" class="account-page__brand">Вау, ми!</router-link>
        <span class="account-page__topbar-title">Личный кабинет</span>
      </div>
    </header>

    <!-- ── Main content ───────────────────────────────────────────────────── -->
    <main class="account-page__main">
      <div class="account-page__container">
        <!-- Profile card -->
        <section class="profile-card">
          <label class="profile-card__avatar" aria-label="Изменить аватар">
            <img
              v-if="authStore.user?.avatarUrl"
              :src="authStore.user.avatarUrl"
              alt=""
              class="profile-card__avatar-img"
            />
            <span v-else class="profile-card__avatar-letter">{{ avatarLetter }}</span>
            <span class="profile-card__avatar-overlay">
              <v-progress-circular v-if="avatarUploading" size="16" width="2" indeterminate color="white" />
              <v-icon v-else size="16" color="white">mdi-camera-outline</v-icon>
            </span>
            <input
              type="file"
              accept="image/*"
              class="profile-card__avatar-input"
              :disabled="avatarUploading"
              @change="handleAvatarChange"
            />
          </label>
          <div class="profile-card__info">
            <div class="profile-card__name-row">
              <span class="profile-card__name">{{ displayName }}</span>
              <button
                type="button"
                class="profile-card__edit-name"
                aria-label="Изменить имя"
                @click="openEditName"
              >
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </div>
            <span class="profile-card__phone">{{ authStore.userPhone ?? '—' }}</span>
          </div>
          <v-btn
            variant="outlined"
            color="error"
            size="small"
            class="profile-card__logout"
            :loading="loggingOut"
            prepend-icon="mdi-logout"
            @click="handleLogout"
          >
            Выйти
          </v-btn>
        </section>

        <v-alert v-if="loadError" type="error" variant="tonal" rounded="lg" class="account-page__alert">
          {{ loadError }}
          <template #append>
            <v-btn variant="text" size="small" :loading="loading" @click="loadOrders">Повторить</v-btn>
          </template>
        </v-alert>

        <!-- Loading skeleton -->
        <div v-if="loading" class="account-page__skeleton-grid" aria-busy="true">
          <div v-for="n in 3" :key="n" class="account-page__skeleton" role="presentation" />
        </div>

        <template v-else>
          <!-- ── Мои журналы (drafts) ──────────────────────────────────────── -->
          <section class="account-section">
            <div class="account-section__header">
              <h2 class="account-section__title">Мои журналы</h2>
              <span v-if="drafts.length" class="account-section__count">{{ drafts.length }}</span>
            </div>

            <div v-if="drafts.length" class="account-page__grid">
              <article v-for="order in drafts" :key="order.id" class="journal-card">
                <div class="journal-card__cover">
                  <JournalSpreadThumbnail
                    v-if="coverCanvas(order)"
                    :canvas-data="coverCanvas(order)!"
                    :container-ratio="0.75"
                  />
                  <div v-else class="journal-card__image journal-card__image--placeholder" />
                </div>
                <div class="journal-card__body">
                  <h3 class="journal-card__name">{{ order.magazineType.name }}</h3>
                  <p class="journal-card__meta">Изменено {{ formatDate(order.updatedAt) }}</p>
                  <div class="journal-card__actions">
                    <v-btn
                      color="primary"
                      size="small"
                      class="journal-card__continue"
                      :loading="continuingId === order.id"
                      @click="continueEditing(order)"
                    >
                      Продолжить редактирование
                    </v-btn>
                    <v-btn
                      icon="mdi-trash-can-outline"
                      size="small"
                      variant="text"
                      aria-label="Удалить черновик"
                      :loading="deletingId === order.id"
                      @click="openDeleteDialog(order)"
                    />
                  </div>
                </div>
              </article>
            </div>

            <div v-else class="account-page__empty">
              <v-icon size="32" color="textDisabled">mdi-book-outline</v-icon>
              <p>Нет черновиков</p>
              <v-btn color="primary" variant="outlined" size="small" :to="{ name: 'create-order' }">
                Создать журнал
              </v-btn>
            </div>
          </section>

          <!-- ── Мои заказы (placed orders) ────────────────────────────────── -->
          <section class="account-section">
            <div class="account-section__header">
              <h2 class="account-section__title">Мои заказы</h2>
              <span v-if="placedOrders.length" class="account-section__count">{{ placedOrders.length }}</span>
            </div>

            <div v-if="placedOrders.length" class="account-page__grid">
              <article v-for="order in placedOrders" :key="order.id" class="order-card">
                <div class="order-card__cover">
                  <JournalSpreadThumbnail
                    v-if="coverCanvas(order)"
                    :canvas-data="coverCanvas(order)!"
                    :container-ratio="0.75"
                  />
                  <div v-else class="order-card__image order-card__image--placeholder" />
                </div>
                <div class="order-card__body">
                  <div class="order-card__top-row">
                    <h3 class="order-card__name">{{ order.magazineType.name }}</h3>
                    <v-chip size="small" variant="tonal" :color="ORDER_STATUS_COLORS[order.status]" label>
                      {{ ORDER_STATUS_LABELS[order.status] }}
                    </v-chip>
                  </div>
                  <p class="order-card__meta">
                    Оформлен {{ formatDate(order.submittedAt ?? order.createdAt) }}
                  </p>
                  <p class="order-card__price">{{ formatPrice(order.totalPrice) }}</p>
                </div>
              </article>
            </div>

            <div v-else class="account-page__empty">
              <v-icon size="32" color="textDisabled">mdi-package-variant-closed</v-icon>
              <p>Заказов пока нет</p>
            </div>
          </section>
        </template>
      </div>
    </main>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>

    <ConfirmModal
      v-model="deleteDialog.open"
      title="Удалить черновик?"
      :message="`Черновик «${deleteDialog.order?.magazineType.name ?? ''}» будет удалён без возможности восстановления.`"
      confirm-label="Удалить"
      :loading="deletingId !== null"
      @confirm="confirmDeleteDraft"
    />

    <BaseModal v-model="editNameDialog.open" labelledby="edit-name-title">
      <div class="edit-name-modal">
        <h2 id="edit-name-title" class="edit-name-modal__title">Изменить имя</h2>
        <v-text-field
          v-model="editNameDialog.value"
          label="Имя"
          placeholder="Как к вам обращаться?"
          variant="outlined"
          autofocus
          maxlength="50"
          counter="50"
          hide-details="auto"
          :error-messages="editNameDialog.error"
          :disabled="editNameDialog.saving"
          @keyup.enter="saveName"
        />
        <div class="edit-name-modal__actions">
          <v-btn
            variant="outlined"
            color="secondary"
            class="edit-name-modal__cancel"
            :disabled="editNameDialog.saving"
            @click="editNameDialog.open = false"
          >
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="edit-name-modal__save"
            :loading="editNameDialog.saving"
            @click="saveName"
          >
            Сохранить
          </v-btn>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'
import { ordersApi, filesApi } from '@/features/order-builder/api/orders.api'
import type { OrderSummary } from '@/features/order-builder/types/order.types'
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/features/order-builder/constants/order-status.constants'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import { resumeOrder } from '@/features/order-builder/utils/resume-order.util'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const authStore = useAuthStore()
const router = useRouter()

const orders = ref<OrderSummary[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const loggingOut = ref(false)
const continuingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const deleteDialog = reactive<{ open: boolean; order: OrderSummary | null }>({
  open: false,
  order: null,
})
const editNameDialog = reactive({ open: false, value: '', saving: false, error: '' })
const avatarUploading = ref(false)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

const displayName = computed(
  () => authStore.user?.name || `Пользователь #${authStore.user?.userNumber ?? ''}`,
)

const drafts = computed(() => orders.value.filter((order) => order.status === 'DRAFT'))
const placedOrders = computed(() => orders.value.filter((order) => order.status !== 'DRAFT'))

/** Bakes saved placeholder-value diffs into the cover page's own document — same materialization
 * the advanced editor uses — so the card thumbnail reflects the customer's actual cover, not just
 * the bare template. `null` when the order has no cover slot at all (shouldn't normally happen). */
function coverCanvas(order: OrderSummary): CanvasData | null {
  const coverPage = order.journalPages[0]
  if (!coverPage) {
    return null
  }
  return materializeCanvasData(normalizeCanvasData(coverPage.pageSnapshot), coverPage.placeholderValues)
}

const avatarLetter = computed(() => {
  const name = authStore.user?.name
  if (name) return name.slice(0, 1).toUpperCase()
  const phone = authStore.userPhone ?? ''
  return phone ? phone.slice(-2, -1) : '?'
})

async function loadOrders(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const result = await ordersApi.list()
    orders.value = result.items
  } catch {
    loadError.value = 'Не удалось загрузить список журналов и заказов'
  } finally {
    loading.value = false
  }
}

async function continueEditing(order: OrderSummary): Promise<void> {
  continuingId.value = order.id
  try {
    await resumeOrder(router, order.id)
  } catch (err: unknown) {
    snackbar.text = err instanceof Error ? err.message : 'Не удалось открыть журнал'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    continuingId.value = null
  }
}

function openEditName(): void {
  editNameDialog.value = authStore.user?.name ?? ''
  editNameDialog.error = ''
  editNameDialog.open = true
}

async function saveName(): Promise<void> {
  editNameDialog.saving = true
  editNameDialog.error = ''
  try {
    await authStore.updateName(editNameDialog.value.trim())
    editNameDialog.open = false
  } catch {
    editNameDialog.error = 'Не удалось сохранить имя'
  } finally {
    editNameDialog.saving = false
  }
}

async function handleAvatarChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) {
    return
  }

  avatarUploading.value = true
  try {
    const uploaded = await filesApi.uploadImage(file)
    await authStore.updateAvatar(uploaded.url)
  } catch {
    snackbar.text = 'Не удалось загрузить фото'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    avatarUploading.value = false
  }
}

function openDeleteDialog(order: OrderSummary): void {
  deleteDialog.order = order
  deleteDialog.open = true
}

async function confirmDeleteDraft(): Promise<void> {
  const order = deleteDialog.order
  if (!order) {
    return
  }

  deletingId.value = order.id
  try {
    await ordersApi.remove(order.id)
    orders.value = orders.value.filter((item) => item.id !== order.id)
    deleteDialog.open = false
  } catch {
    snackbar.text = 'Не удалось удалить черновик'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    deletingId.value = null
  }
}

async function handleLogout(): Promise<void> {
  loggingOut.value = true
  try {
    await authStore.logout()
  } catch {
    // ignore — local state is cleared regardless, see auth.store.ts
  } finally {
    loggingOut.value = false
    await router.push('/auth')
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

function formatPrice(value: string | null): string {
  if (value == null || value === '') return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return '—'
  return `${priceFormatter.format(num)} ₽`
}

onMounted(loadOrders)
</script>

<style scoped lang="scss">
// ── Page layout ──────────────────────────────────────────────────────────────
.account-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-primary;
}

// ── Top bar ───────────────────────────────────────────────────────────────────
.account-page__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;
}

.account-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: $spacing-4;
  @include page-container;
}

.account-page__brand {
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

.account-page__topbar-title {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
  padding-left: $spacing-4;
  border-left: 1px solid $border-light;
}

// ── Main ──────────────────────────────────────────────────────────────────────
.account-page__main {
  flex: 1;
  padding-block: $spacing-8 $spacing-16;
}

.account-page__container {
  @include page-container;
  max-width: 1200px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.account-page__alert {
  margin-top: -#{$spacing-6};
}

// ── Profile card ──────────────────────────────────────────────────────────────
.profile-card {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-4 $spacing-6;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;

  @include mobile-only {
    flex-wrap: wrap;
  }
}

.profile-card__avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: $bg-tertiary;
  overflow: hidden;
  cursor: pointer;
}

.profile-card__avatar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-card__avatar-letter {
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.profile-card__avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($black, 0.45);
  transition: opacity 150ms ease;

  @media (hover: hover) and (pointer: fine) {
    opacity: 0;
  }
}

.profile-card__avatar:hover .profile-card__avatar-overlay,
.profile-card__avatar:focus-within .profile-card__avatar-overlay {
  opacity: 1;
}

.profile-card__avatar-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.profile-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.profile-card__name-row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  min-width: 0;
}

.profile-card__name {
  font-family: $font-family-body;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-card__edit-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: $radius-xs;
  background: none;
  color: $text-muted;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;

  &:hover {
    color: $accent;
    background: $accent-tint;
  }
}

.profile-card__phone {
  font-size: $font-size-body-sm;
  color: $text-muted;
}

.profile-card__logout {
  flex-shrink: 0;
  text-transform: none;
}

// ── Edit name modal ───────────────────────────────────────────────────────────
.edit-name-modal {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  width: min(100%, 380px);
  margin-inline: auto;
}

.edit-name-modal__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
  text-align: center;
}

.edit-name-modal__actions {
  display: flex;
  gap: $spacing-3;
}

.edit-name-modal__cancel,
.edit-name-modal__save {
  flex: 1;
  text-transform: none;
}

// ── Sections ──────────────────────────────────────────────────────────────────
.account-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.account-section__header {
  display: flex;
  align-items: baseline;
  gap: $spacing-2;
}

.account-section__title {
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.account-section__count {
  font-size: $font-size-body-sm;
  color: $text-muted;
}

// ── Grid ──────────────────────────────────────────────────────────────────────
.account-page__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $spacing-4;

  @include tablet-up {
    grid-template-columns: repeat(2, 1fr);
  }

  @include desktop-up {
    grid-template-columns: repeat(3, 1fr);
  }
}

.account-page__skeleton-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $spacing-4;

  @include tablet-up {
    grid-template-columns: repeat(3, 1fr);
  }
}

.account-page__skeleton {
  border-radius: $radius-md;
  background: $bg-tertiary;
  aspect-ratio: 3 / 2;
  animation: account-skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes account-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

.account-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-12 $spacing-4;
  border: 1px dashed $border-default;
  border-radius: $radius-md;
  color: $text-muted;
  text-align: center;

  p {
    font-family: $font-family-body;
    font-size: $font-size-body-sm;
    margin: 0;
  }
}

// ── Journal / order cards ─────────────────────────────────────────────────────
.journal-card,
.order-card {
  display: flex;
  gap: $spacing-4;
  padding: $spacing-3;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}

.journal-card__cover,
.order-card__cover {
  position: relative;
  width: 88px;
  aspect-ratio: 3 / 4;
  flex-shrink: 0;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-tertiary;
}

.journal-card__image,
.order-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;

  &--placeholder {
    background: $bg-tertiary;
  }
}

.journal-card__body,
.order-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.journal-card__name,
.order-card__name {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.journal-card__meta,
.order-card__meta {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.journal-card__actions {
  margin-top: auto;
  padding-top: $spacing-2;
  display: flex;
  align-items: center;
  gap: $spacing-1;
}

.journal-card__continue {
  text-transform: none;
  flex: 1;
}

.order-card__top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-2;
}

.order-card__price {
  margin-top: auto;
  padding-top: $spacing-2;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-semibold;
  font-variant-numeric: tabular-nums;
  color: $text-primary;
}
</style>
