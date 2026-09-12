<template>
  <div class="checkout-page">
    <header class="checkout-page__topbar">
      <div class="checkout-page__topbar-inner">
        <router-link to="/" class="checkout-page__brand">Фолио</router-link>
        <span class="checkout-page__topbar-title">Оформление заказа</span>
      </div>
    </header>

    <main class="checkout-page__main">
      <div v-if="loading" class="checkout-page__loading">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <v-alert v-else-if="loadError" type="error" variant="tonal" rounded="lg" class="checkout-page__alert">
        {{ loadError }}
      </v-alert>

      <div v-else-if="order" class="checkout-page__container">
        <div class="checkout-page__forms">
          <!-- Доставка -->
          <section class="checkout-card">
            <h2 class="checkout-card__title">Доставка</h2>

            <div class="checkout-card__method">
              <button
                type="button"
                class="checkout-method"
                :class="{ 'checkout-method--active': deliveryForm.method === 'PICKUP_POINT' }"
                @click="deliveryForm.method = 'PICKUP_POINT'"
              >
                <v-icon size="18">mdi-map-marker-outline</v-icon>
                ПВЗ СДЭК
              </button>
              <button
                type="button"
                class="checkout-method"
                :class="{ 'checkout-method--active': deliveryForm.method === 'COURIER' }"
                @click="deliveryForm.method = 'COURIER'"
              >
                <v-icon size="18">mdi-truck-outline</v-icon>
                Курьером до двери
              </button>
            </div>

            <div class="checkout-card__form">
              <v-text-field
                v-model="deliveryForm.city"
                label="Город"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />
              <v-text-field
                v-model="deliveryForm.address"
                :label="addressLabel"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />
              <div class="checkout-card__row">
                <v-text-field
                  v-model="deliveryForm.postalCode"
                  label="Индекс"
                  variant="outlined"
                  density="comfortable"
                  inputmode="numeric"
                  hide-details="auto"
                />
                <v-text-field
                  v-model="deliveryForm.recipientPhone"
                  label="Телефон получателя"
                  variant="outlined"
                  density="comfortable"
                  type="tel"
                  hide-details="auto"
                />
              </div>
              <v-text-field
                v-model="deliveryForm.recipientName"
                label="ФИО получателя"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />
            </div>

            <p v-if="deliveryError" class="checkout-card__error">{{ deliveryError }}</p>

            <v-btn
              color="primary"
              variant="outlined"
              class="checkout-card__calc-btn"
              :loading="calculatingDelivery"
              @click="handleCalculateDelivery"
            >
              Рассчитать доставку
            </v-btn>

            <p v-if="order.deliveryPrice != null" class="checkout-card__result">
              Стоимость доставки: <strong>{{ formatPrice(order.deliveryPrice) }}</strong>
              · срок: <strong>{{ order.deliveryEtaDays }} {{ pluralizeDays(order.deliveryEtaDays ?? 0) }}</strong>
            </p>
          </section>

          <!-- Сроки изготовления -->
          <section class="checkout-card checkout-card--info">
            <v-icon size="22" color="primary">mdi-clock-outline</v-icon>
            <p>Изготовление журнала занимает 5–7 рабочих дней после подтверждения заказа.</p>
          </section>

          <!-- Промокод -->
          <section class="checkout-card">
            <h2 class="checkout-card__title">Промокод</h2>

            <div v-if="order.promoCode" class="checkout-promo-applied">
              <span>Промокод «{{ order.promoCode.code }}» применён</span>
              <button type="button" class="checkout-promo-applied__remove" @click="handleRemovePromo">
                Удалить
              </button>
            </div>

            <div v-else class="checkout-card__row">
              <v-text-field
                v-model="promoInput"
                label="Введите промокод"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                @keyup.enter="handleApplyPromo"
              />
              <v-btn
                color="primary"
                variant="outlined"
                :loading="applyingPromo"
                :disabled="!promoInput.trim()"
                @click="handleApplyPromo"
              >
                Применить
              </v-btn>
            </div>

            <p v-if="promoError" class="checkout-card__error">{{ promoError }}</p>
          </section>
        </div>

        <aside class="checkout-summary">
          <div class="checkout-summary__cover">
            <JournalSpreadThumbnail v-if="coverCanvas" :canvas-data="coverCanvas" :container-ratio="0.75" />
          </div>
          <h3 class="checkout-summary__name">{{ order.magazineType.name }}</h3>

          <div class="checkout-summary__row">
            <span>Журнал ({{ priceBreakdown.includedPages }} стр.)</span>
            <span>{{ formatPrice(priceBreakdown.basePrice) }}</span>
          </div>
          <div v-if="priceBreakdown.extraPages > 0" class="checkout-summary__row">
            <span>Доп. страницы ({{ priceBreakdown.extraPages }} стр.)</span>
            <span>{{ formatPrice(priceBreakdown.extraPagesPrice) }}</span>
          </div>
          <div v-if="deliveryPrice != null" class="checkout-summary__row">
            <span>Доставка</span>
            <span>{{ formatPrice(deliveryPrice) }}</span>
          </div>
          <div v-if="discountAmount" class="checkout-summary__row checkout-summary__row--discount">
            <span>Скидка</span>
            <span>−{{ formatPrice(discountAmount) }}</span>
          </div>

          <div class="checkout-summary__total">
            <span>Итого</span>
            <span>{{ formatPrice(grandTotal) }}</span>
          </div>

          <v-btn
            color="primary"
            size="large"
            block
            class="checkout-summary__submit"
            :disabled="!order.deliveryMethod"
            :loading="submitting"
            @click="handleFinalSubmit"
          >
            Оформить заказ
          </v-btn>
          <p v-if="!order.deliveryMethod" class="checkout-summary__hint">
            Сначала рассчитайте доставку
          </p>
        </aside>
      </div>
    </main>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { ordersApi } from '../api/orders.api'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { countSpreadSlots } from '../utils/journal-structure.util'
import { calculateJournalPriceBreakdown } from '../utils/pricing.util'
import type { DeliveryMethod, OrderDetail } from '../types/order.types'

const route = useRoute()
const router = useRouter()
const orderId = computed(() => route.params.orderId as string)

const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

const deliveryForm = reactive({
  method: 'PICKUP_POINT' as DeliveryMethod,
  city: '',
  address: '',
  postalCode: '',
  recipientName: '',
  recipientPhone: '',
})
const calculatingDelivery = ref(false)
const deliveryError = ref('')

const promoInput = ref('')
const applyingPromo = ref(false)
const promoError = ref('')

const submitting = ref(false)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

const addressLabel = computed(() =>
  deliveryForm.method === 'COURIER' ? 'Адрес (улица, дом, квартира)' : 'Адрес пункта выдачи',
)

const coverCanvas = computed<CanvasData | null>(() => {
  const pages = order.value?.journalPages ?? []
  const cover = pages.find((page) => page.slotType === 'COVER') ?? pages[0]
  if (!cover) {
    return null
  }
  return materializeCanvasData(normalizeCanvasData(cover.pageSnapshot), cover.placeholderValues)
})

/** Base price + extra-4-pages surcharge, broken out so the checkout summary can show the user
 * exactly what they're paying for (the journal's included pages vs. what they added beyond
 * that), rather than a single lump sum. Computed client-side from the magazine type's pricing
 * config + the order's actual spread count, mirroring the backend's
 * `calculateJournalPriceBreakdown` — kept in sync with `order.totalPrice` since the backend
 * recomputes that with the same formula on every spread add. */
const priceBreakdown = computed(() => {
  if (!order.value) {
    return { basePrice: 0, includedPages: 0, extraPages: 0, extraPagesPrice: 0, total: 0 }
  }

  const magazineType = order.value.magazineType
  return calculateJournalPriceBreakdown(
    {
      basePrice: magazineType.basePrice != null ? Number(magazineType.basePrice) : null,
      includedSpreads: magazineType.includedSpreads,
      pricePerExtraFourPages:
        magazineType.pricePerExtraFourPages != null ? Number(magazineType.pricePerExtraFourPages) : null,
    },
    countSpreadSlots(order.value.journalPages),
  )
})

const itemPrice = computed(() => priceBreakdown.value.total)
const deliveryPrice = computed(() =>
  order.value?.deliveryPrice != null ? Number(order.value.deliveryPrice) : null,
)
const discountAmount = computed(() =>
  order.value?.discountAmount != null ? Number(order.value.discountAmount) : null,
)
const grandTotal = computed(() => itemPrice.value + (deliveryPrice.value ?? 0) - (discountAmount.value ?? 0))

function fillDeliveryForm(detail: OrderDetail): void {
  deliveryForm.method = detail.deliveryMethod ?? 'PICKUP_POINT'
  deliveryForm.city = detail.deliveryCity ?? ''
  deliveryForm.address = detail.deliveryAddress ?? ''
  deliveryForm.postalCode = detail.deliveryPostalCode ?? ''
  deliveryForm.recipientName = detail.recipientName ?? ''
  deliveryForm.recipientPhone = detail.recipientPhone ?? ''
}

async function loadOrder(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const detail = await ordersApi.getOne(orderId.value)
    order.value = detail
    fillDeliveryForm(detail)
  } catch {
    loadError.value = 'Не удалось загрузить заказ'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrder)

function extractErrorMessage(err: unknown): string | null {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: string } } }
    return e.response?.data?.message ?? null
  }
  return null
}

async function handleCalculateDelivery(): Promise<void> {
  if (
    !deliveryForm.city.trim() ||
    !deliveryForm.address.trim() ||
    !deliveryForm.recipientName.trim() ||
    !deliveryForm.recipientPhone.trim()
  ) {
    deliveryError.value = 'Заполните город, адрес, ФИО и телефон получателя'
    return
  }

  deliveryError.value = ''
  calculatingDelivery.value = true
  try {
    order.value = await ordersApi.calculateDelivery(orderId.value, {
      method: deliveryForm.method,
      city: deliveryForm.city.trim(),
      address: deliveryForm.address.trim(),
      postalCode: deliveryForm.postalCode.trim() || undefined,
      recipientName: deliveryForm.recipientName.trim(),
      recipientPhone: deliveryForm.recipientPhone.trim(),
    })
  } catch (err: unknown) {
    deliveryError.value = extractErrorMessage(err) ?? 'Не удалось рассчитать доставку'
  } finally {
    calculatingDelivery.value = false
  }
}

async function handleApplyPromo(): Promise<void> {
  if (!promoInput.value.trim()) {
    return
  }

  promoError.value = ''
  applyingPromo.value = true
  try {
    order.value = await ordersApi.applyPromoCode(orderId.value, promoInput.value.trim())
    promoInput.value = ''
  } catch (err: unknown) {
    promoError.value = extractErrorMessage(err) ?? 'Не удалось применить промокод'
  } finally {
    applyingPromo.value = false
  }
}

async function handleRemovePromo(): Promise<void> {
  try {
    order.value = await ordersApi.removePromoCode(orderId.value)
  } catch {
    snackbar.text = 'Не удалось удалить промокод'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function handleFinalSubmit(): Promise<void> {
  submitting.value = true
  try {
    await ordersApi.submit(orderId.value)
    snackbar.text = 'Заказ отправлен!'
    snackbar.color = 'success'
    snackbar.show = true
    await router.push({ name: 'account' })
  } catch (err: unknown) {
    snackbar.text = extractErrorMessage(err) ?? 'Не удалось оформить заказ'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    submitting.value = false
  }
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

function formatPrice(value: number | string | null | undefined): string {
  if (value == null || value === '') {
    return '—'
  }
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) {
    return '—'
  }
  return `${priceFormatter.format(num)} ₽`
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}
</script>

<style scoped lang="scss">
// ── Page layout ──────────────────────────────────────────────────────────────
.checkout-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-primary;
}

// ── Top bar ───────────────────────────────────────────────────────────────────
.checkout-page__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;
}

.checkout-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: $spacing-4;
  @include page-container;
}

.checkout-page__brand {
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

.checkout-page__topbar-title {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
  padding-left: $spacing-4;
  border-left: 1px solid $border-light;
}

// ── Main ──────────────────────────────────────────────────────────────────────
.checkout-page__main {
  flex: 1;
  padding-block: $spacing-8 $spacing-16;
}

.checkout-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-block: $spacing-16;
}

.checkout-page__alert {
  @include page-container;
  max-width: 640px;
  margin-inline: auto;
}

.checkout-page__container {
  @include page-container;
  max-width: 1080px;
  margin-inline: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: $spacing-6;

  @include desktop-up {
    grid-template-columns: 1fr 340px;
    align-items: start;
  }
}

.checkout-page__forms {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

// ── Cards ─────────────────────────────────────────────────────────────────────
.checkout-card {
  padding: $spacing-6;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;

  &--info {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    background: $accent-tint;
    border: none;

    p {
      margin: 0;
      font-size: $font-size-body-sm;
      color: $text-primary;
    }
  }
}

.checkout-card__title {
  margin: 0 0 $spacing-4;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.checkout-card__method {
  display: flex;
  gap: $spacing-3;
  margin-bottom: $spacing-4;
}

.checkout-method {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  padding: $spacing-3;
  border: 1px solid $border-default;
  border-radius: $radius-md;
  background: $bg-primary;
  color: $text-secondary;
  cursor: pointer;
  font-size: $font-size-body-sm;
  transition: border-color 0.12s ease, color 0.12s ease;

  &--active {
    border-color: $accent;
    color: $accent;
    background: $accent-tint;
  }
}

.checkout-card__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.checkout-card__row {
  display: flex;
  gap: $spacing-4;

  @include mobile-only {
    flex-direction: column;
  }
}

.checkout-card__error {
  margin: $spacing-3 0 0;
  font-size: $font-size-body-sm;
  color: #e5484d;
}

.checkout-card__calc-btn {
  margin-top: $spacing-4;
  text-transform: none;
}

.checkout-card__result {
  margin: $spacing-3 0 0;
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

// ── Promo ─────────────────────────────────────────────────────────────────────
.checkout-promo-applied {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  background: $accent-tint;
  border-radius: $radius-md;
  font-size: $font-size-body-sm;
  color: $text-primary;
}

.checkout-promo-applied__remove {
  border: none;
  background: none;
  padding: 0;
  color: $accent;
  cursor: pointer;
  font-size: $font-size-body-sm;
  text-decoration: underline;
}

// ── Summary sidebar ───────────────────────────────────────────────────────────
.checkout-summary {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-6;
  background: $bg-elevated;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;

  @include desktop-up {
    position: sticky;
    top: 88px;
  }
}

.checkout-summary__cover {
  position: relative;
  width: 100%;
  max-width: 160px;
  aspect-ratio: 3 / 4;
  margin: 0 auto $spacing-4;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-tertiary;
}

.checkout-summary__name {
  margin: 0 0 $spacing-4;
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
  text-align: center;
}

.checkout-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-body-sm;
  color: $text-secondary;

  &--discount {
    color: $accent;
  }
}

.checkout-summary__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: $spacing-3;
  padding-top: $spacing-3;
  border-top: 1px solid $border-light;
  font-size: $font-size-body-lg;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.checkout-summary__submit {
  margin-top: $spacing-4;
  text-transform: none;
}

.checkout-summary__hint {
  margin: $spacing-2 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
  text-align: center;
}
</style>
