<template>
  <div class="checkout-page">
    <header class="checkout-page__topbar">
      <div class="checkout-page__topbar-inner">
        <div class="checkout-page__topbar-left">
          <router-link to="/" class="checkout-page__brand">Вау, ми!</router-link>
          <span class="checkout-page__topbar-title">Оформление заказа</span>
        </div>

        <div class="checkout-page__steps-label" aria-label="Шаг 5 из 5">
          <span class="checkout-page__steps-current">5</span>
          <span class="checkout-page__steps-sep">/</span>
          <span class="checkout-page__steps-total">5</span>
        </div>
      </div>
    </header>

    <!-- Mobile-only stepper — same 5 steps as .checkout-page__steps-label above, just a fuller
         visual (desktop keeps the thin "5/5" text instead). This page is always step 5. Already-
         completed steps (< 5) are clickable — jump straight back to them; the active step isn't
         (already here). -->
    <ol class="checkout-page__stepper" aria-label="Шаг 5 из 5: Оплата">
      <li
        v-for="step in ORDER_STEPS"
        :key="step.step"
        class="checkout-page__stepper-item"
        :class="{
          'checkout-page__stepper-item--done': step.step < 5,
          'checkout-page__stepper-item--active': step.step === 5,
        }"
      >
        <button
          v-if="step.step < 5"
          type="button"
          class="checkout-page__stepper-btn"
          :aria-label="`Перейти к шагу «${step.label}»`"
          @click="goToStep(step.step)"
        >
          <span class="checkout-page__stepper-node"><v-icon size="10">mdi-check</v-icon></span>
          <span class="checkout-page__stepper-label">{{ step.label }}</span>
        </button>
        <template v-else>
          <span class="checkout-page__stepper-node">{{ step.step }}</span>
          <span class="checkout-page__stepper-label">{{ step.label }}</span>
        </template>
      </li>
    </ol>

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

            <template v-if="widgetConfigured">
              <div id="cdek-widget-root" class="checkout-cdek-widget"></div>
              <p v-if="widgetLoadError" class="checkout-card__error">{{ widgetLoadError }}</p>
            </template>
            <v-alert v-else type="info" variant="tonal" density="comfortable" class="mb-4">
              Виджет СДЭК ещё не настроен (нет ключа Яндекс.Карт) — используется тестовый расчёт.
            </v-alert>

            <div class="checkout-card__form">
              <template v-if="!widgetConfigured">
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
              </template>
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
              v-if="!widgetConfigured"
              color="primary"
              variant="outlined"
              class="checkout-card__calc-btn"
              :loading="calculatingDelivery"
              @click="handleCalculateDelivery"
            >
              Рассчитать доставку
            </v-btn>
            <v-btn
              v-else-if="widgetChoice"
              color="primary"
              variant="outlined"
              class="checkout-card__calc-btn"
              :loading="calculatingDelivery"
              :disabled="!deliveryForm.recipientName.trim() || !deliveryForm.recipientPhone.trim()"
              @click="handleCalculateDelivery"
            >
              Подтвердить доставку
            </v-btn>

            <p v-if="order.deliveryPrice != null" class="checkout-card__result">
              Стоимость доставки: <strong>{{ formatPrice(order.deliveryPrice) }}</strong>
              · срок: <strong>{{ order.deliveryEtaDays }} {{ pluralizeDays(order.deliveryEtaDays ?? 0) }}</strong>
            </p>
          </section>

          <!-- Сроки изготовления -->
          <section class="checkout-card checkout-card--info">
            <v-icon size="22" color="primary">mdi-clock-outline</v-icon>
            <p>Изготовление журнала занимает {{ productionDaysLabel }} после подтверждения заказа.</p>
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
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'
import { loadScript } from '@/shared/utils/load-script.util'
import {
  CDEK_WIDGET_SCRIPT_URL,
  getCdekFromCity,
  getCdekServicePath,
  getYandexMapsApiKey,
  isCdekWidgetConfigured,
} from '@/shared/config/cdek'
import { settingsApi } from '@/shared/api/settings.api'
import { ordersApi } from '../api/orders.api'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { countSpreadSlots } from '../utils/journal-structure.util'
import { calculateJournalPriceBreakdown } from '../utils/pricing.util'
import type { DeliveryMethod, OrderDetail } from '../types/order.types'

const route = useRoute()
const router = useRouter()
const orderId = computed(() => route.params.orderId as string)

// Mobile stepper labels — same list/pattern as PhotoUploadPage.vue's own ORDER_STEPS (see its doc
// comment); duplicated per page rather than shared since each page is always exactly one fixed step.
const ORDER_STEPS = [
  { step: 1, label: 'Журнал' },
  { step: 2, label: 'Фото' },
  { step: 3, label: 'Анкета' },
  { step: 4, label: 'Проверка' },
  { step: 5, label: 'Оплата' },
]

/** The mobile stepper's own click-to-jump (see .checkout-page__stepper) — only ever called for an
 * already-completed step (< 5 here), never the active one. */
function goToStep(step: number): void {
  if (step === 1) {
    void router.push({ name: 'create-order' })
  } else if (step === 2) {
    void router.push({ name: 'order-photo-upload', params: { orderId: orderId.value } })
  } else if (step === 3) {
    void router.push({ name: 'order-questionnaire', params: { orderId: orderId.value } })
  } else if (step === 4) {
    void router.push({ name: 'order-review', params: { orderId: orderId.value } })
  }
}

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

const widgetConfigured = isCdekWidgetConfigured()
const widgetLoadError = ref('')
/** Set once the widget's onChoose callback fires — holds the real price/eta/pickup-point until
 * the user confirms (clicks "Подтвердить доставку"), so we don't send the order to the backend
 * before ФИО/телефон are actually filled in. */
const widgetChoice = ref<{ price: number; etaDays: number; pickupPointCode?: string } | null>(null)

const promoInput = ref('')
const applyingPromo = ref(false)
const promoError = ref('')

const submitting = ref(false)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

/** Admin-configured production lead time — defaults match `PlatformSettings`' schema defaults,
 * shown until the real value loads. */
const productionDays = reactive({ min: 5, max: 7 })
const productionDaysLabel = computed(
  () => `${productionDays.min}–${productionDays.max} рабочих ${pluralizeDays(productionDays.max)}`,
)

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

/** `from`/`servicePath` don't depend on order data, so the widget can mount as soon as the DOM
 * node exists — no need to wait for `loadOrder()`. */
async function initCdekWidget(): Promise<void> {
  if (!widgetConfigured) {
    return
  }

  try {
    await loadScript(CDEK_WIDGET_SCRIPT_URL)
    await nextTick()

    if (!window.CDEKWidget) {
      widgetLoadError.value = 'Не удалось загрузить виджет доставки'
      return
    }

    new window.CDEKWidget({
      from: getCdekFromCity(),
      defaultLocation: getCdekFromCity(),
      root: 'cdek-widget-root',
      apiKey: getYandexMapsApiKey(),
      servicePath: getCdekServicePath(),
      canChoose: true,
      lang: 'rus',
      currency: 'RUB',
      onChoose: (mode, tariff, address) => {
        deliveryForm.method = mode === 'door' ? 'COURIER' : 'PICKUP_POINT'
        deliveryForm.city = address.city ?? deliveryForm.city
        deliveryForm.address = address.address ?? address.name ?? deliveryForm.address
        deliveryForm.postalCode = address.postal_code ?? deliveryForm.postalCode
        widgetChoice.value = {
          price: tariff.delivery_sum,
          etaDays: tariff.period_max,
          pickupPointCode: address.code,
        }
        deliveryError.value = ''
      },
    })
  } catch {
    widgetLoadError.value = 'Не удалось загрузить виджет доставки'
  }
}

async function loadProductionDays(): Promise<void> {
  try {
    const settings = await settingsApi.get()
    productionDays.min = settings.productionDaysMin
    productionDays.max = settings.productionDaysMax
  } catch {
    // Non-critical — keeps showing the default 5–7 days.
  }
}

onMounted(() => {
  void loadOrder()
  void initCdekWidget()
  void loadProductionDays()
})

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
      // Real values from the CDEK widget, when it's the one driving this — see initCdekWidget's
      // onChoose. Absent → backend falls back to its own stub formula.
      price: widgetChoice.value?.price,
      etaDays: widgetChoice.value?.etaDays,
      pickupPointCode: widgetChoice.value?.pickupPointCode,
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

  @include mobile-only {
    height: 44px;
  }
}

.checkout-page__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

.checkout-page__topbar-left {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  min-width: 0;
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

  @include mobile-only {
    font-size: $font-size-body-sm;
  }
}

.checkout-page__topbar-title {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;
  padding-left: $spacing-4;
  border-left: 1px solid $border-light;
  white-space: nowrap;

  @include mobile-only {
    display: none;
  }
}

.checkout-page__steps-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex-shrink: 0;
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  color: $text-muted;

  @include mobile-only {
    font-size: $font-size-caption;
  }
}

.checkout-page__steps-current {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.checkout-page__steps-sep {
  margin-inline: 2px;
}

// ── Mobile stepper — same as QuestionnairePage.vue's own .questionnaire-page__stepper — desktop
// keeps the thin "5/5" text in the topbar instead. ─────────────────────────────────────────────
.checkout-page__stepper {
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

.checkout-page__stepper-item {
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

  &--done:not(:last-child)::after {
    background: $accent;
  }
}

// Wraps a completed step's node+label so it's clickable (see the template) — reset to blend back
// into the item's own layout, since this is purely an interactivity wrapper, not a visual one.
.checkout-page__stepper-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;

  &:hover .checkout-page__stepper-node {
    transform: scale(1.1);
  }
}

.checkout-page__stepper-node {
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

  .checkout-page__stepper-item--done & {
    border-color: $accent;
    background: $accent;
    color: $white;
  }

  .checkout-page__stepper-item--active & {
    border-color: $accent;
    color: $accent;
  }
}

.checkout-page__stepper-label {
  font-size: 9px;
  color: $text-muted;
  text-align: center;
  white-space: nowrap;

  .checkout-page__stepper-item--active & {
    color: $text-primary;
    font-weight: $font-weight-semibold;
  }

  .checkout-page__stepper-item--done & {
    color: $text-secondary;
  }
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

  // Side-by-side flex:1 buttons get cramped on narrow phones — "Курьером до двери" wraps awkwardly
  // at half-width. Stacked, each keeps a comfortable touch target and its label on one line.
  @include mobile-only {
    flex-direction: column;
  }
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

.checkout-cdek-widget {
  width: 100%;
  height: 420px;
  margin-bottom: $spacing-4;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-tertiary;
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
