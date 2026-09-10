<template>
  <div class="od-page">
    <div class="od-page__inner">
      <header class="od-page__header">
        <div>
          <router-link :to="{ name: 'admin-orders' }" class="od-page__back">
            <v-icon size="16">mdi-arrow-left</v-icon>
            Заказы
          </router-link>
          <h1 class="od-page__title">Заказ №{{ shortId }}</h1>
        </div>
        <v-chip v-if="order" :color="STATUS_COLORS[order.status]" size="small" variant="tonal" label>
          {{ STATUS_LABELS[order.status] }}
        </v-chip>
      </header>

      <div v-if="store.loadingCurrent" class="od-page__loading">
        <v-progress-circular indeterminate color="primary" size="32" />
      </div>

      <div v-else-if="!order" class="od-page__empty">
        <v-icon size="40" color="textDisabled">mdi-alert-circle-outline</v-icon>
        <p>Заказ не найден</p>
      </div>

      <template v-else>
        <div class="od-page__grid">
          <!-- Summary card -->
          <v-card variant="outlined" class="od-card">
            <v-card-text class="od-card__body">
              <h2 class="od-card__title">Сводка</h2>
              <dl class="od-info-list">
                <div class="od-info-list__row">
                  <dt>Журнал</dt>
                  <dd>{{ order.magazineType.name }}</dd>
                </div>
                <div v-if="order.magazineStyle" class="od-info-list__row">
                  <dt>Стиль</dt>
                  <dd>{{ order.magazineStyle.name }}</dd>
                </div>
                <div class="od-info-list__row">
                  <dt>Сумма</dt>
                  <dd class="od-info-list__price">{{ formatPrice(order.totalPrice) }}</dd>
                </div>
                <div class="od-info-list__row">
                  <dt>Оформлен</dt>
                  <dd>{{ order.submittedAt ? formatDateTime(order.submittedAt) : '—' }}</dd>
                </div>
                <div class="od-info-list__row">
                  <dt>Создан</dt>
                  <dd>{{ formatDateTime(order.createdAt) }}</dd>
                </div>
                <div v-if="order.paidAt" class="od-info-list__row">
                  <dt>Оплачен</dt>
                  <dd>{{ formatDateTime(order.paidAt) }}</dd>
                </div>
                <div v-if="order.completedAt" class="od-info-list__row">
                  <dt>Завершён</dt>
                  <dd>{{ formatDateTime(order.completedAt) }}</dd>
                </div>
              </dl>
              <p v-if="order.notes" class="od-card__notes">{{ order.notes }}</p>
            </v-card-text>
          </v-card>

          <!-- Customer card -->
          <v-card variant="outlined" class="od-card">
            <v-card-text class="od-card__body">
              <h2 class="od-card__title">Покупатель</h2>
              <dl class="od-info-list">
                <div class="od-info-list__row">
                  <dt>Имя</dt>
                  <dd>{{ order.user.name || '—' }}</dd>
                </div>
                <div class="od-info-list__row">
                  <dt>Телефон</dt>
                  <dd>{{ order.user.phone || '—' }}</dd>
                </div>
                <div v-if="order.user.email" class="od-info-list__row">
                  <dt>Email</dt>
                  <dd>{{ order.user.email }}</dd>
                </div>
              </dl>
            </v-card-text>
          </v-card>
        </div>

        <!-- Journal pages -->
        <v-card variant="outlined" class="od-card">
          <v-card-text class="od-card__body">
            <h2 class="od-card__title">Развороты журнала ({{ order.journalPages.length }})</h2>
            <div class="od-pages">
              <router-link
                v-for="page in order.journalPages"
                :key="page.id"
                :to="{ name: 'admin-order-journal-page-editor', params: { orderId, journalPageId: page.id } }"
                class="od-page-item"
              >
                <div class="od-page-item__thumbs">
                  <JournalSpreadThumbnail :canvas-data="materializedCanvas(page)" />
                  <div class="od-page-item__edit-overlay">
                    <v-icon size="20" color="white">mdi-pencil-outline</v-icon>
                  </div>
                </div>
                <div class="od-page-item__meta">
                  <span class="od-page-item__order">#{{ page.sortOrder + 1 }}</span>
                  <span class="od-page-item__type">{{ page.magazinePage.pageType }}</span>
                </div>
              </router-link>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminOrdersStore } from '../stores/orders.store'
import type { AdminOrderJournalPage, AdminOrderStatus } from '@/shared/api/admin/orders.api'
import type { CanvasData } from '@/modules/editor/models/canvas-data.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import JournalSpreadThumbnail from '@/modules/editor/components/JournalSpreadThumbnail.vue'

const route = useRoute()
const store = useAdminOrdersStore()

const orderId = route.params.id as string
const order = computed(() => store.current)
const shortId = computed(() => orderId.slice(0, 8))

onMounted(() => {
  void store.loadOrder(orderId)
})

/** Bakes saved placeholder-value diffs into the page's own document — same materialization the
 * advanced editor uses — so the thumbnail reflects what the customer actually placed, not just
 * the bare template. */
function materializedCanvas(page: AdminOrderJournalPage): CanvasData {
  return materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues)
}

const STATUS_LABELS: Record<AdminOrderStatus, string> = {
  DRAFT: 'Черновик',
  SUBMITTED: 'Оформлен',
  PAYMENT_PENDING: 'Ожидает оплаты',
  PAYMENT_FAILED: 'Ошибка оплаты',
  PAID: 'Оплачен',
  IN_DESIGN: 'В дизайне',
  DESIGN_REVIEW: 'На проверке',
  APPROVED: 'Утверждён',
  PRINTING: 'В печати',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
}

const STATUS_COLORS: Record<AdminOrderStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  PAYMENT_PENDING: 'warning',
  PAYMENT_FAILED: 'error',
  PAID: 'success',
  IN_DESIGN: 'info',
  DESIGN_REVIEW: 'warning',
  APPROVED: 'success',
  PRINTING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
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
</script>

<style scoped lang="scss">
.od-page {
  min-height: 100%;
}

.od-page__inner {
  @include page-container;
  max-width: 1100px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.od-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-4;
}

.od-page__back {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  font-size: $font-size-body-sm;
  color: $text-muted;
  text-decoration: none;
  margin-bottom: $spacing-2;

  &:hover {
    color: $text-primary;
  }
}

.od-page__title {
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.od-page__loading,
.od-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  padding: $spacing-16 0;
  color: $text-muted;
}

.od-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: $spacing-4;
}

.od-card {
  border-color: $border-light !important;
}

.od-card__body {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.od-card__title {
  font-family: $font-family-body;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
}

.od-card__notes {
  font-size: $font-size-body-sm;
  color: $text-secondary;
  white-space: pre-wrap;
  margin: 0;
}

.od-info-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  margin: 0;
}

.od-info-list__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-3;

  dt {
    font-size: $font-size-body-sm;
    color: $text-muted;
  }

  dd {
    font-size: $font-size-body-sm;
    color: $text-primary;
    margin: 0;
    text-align: right;
  }
}

.od-info-list__price {
  font-weight: $font-weight-medium;
  font-variant-numeric: tabular-nums;
}

.od-pages {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: $spacing-3;
}

.od-page-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  text-decoration: none;
  color: inherit;
}

.od-page-item__thumbs {
  position: relative;
  aspect-ratio: 1.4;
  border-radius: $radius-xs;
  overflow: hidden;
  background: $bg-tertiary;
}

.od-page-item__edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.od-page-item:hover .od-page-item__edit-overlay {
  opacity: 1;
}

.od-page-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-1;
  font-size: $font-size-caption;
  color: $text-muted;
}

.od-page-item__order {
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.od-page-item__type {
  text-transform: lowercase;
}
</style>
