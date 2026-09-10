<template>
  <div class="ao-page">
    <div class="ao-page__inner">

      <!-- ── Page header ─────────────────────────────────────────────────── -->
      <header class="ao-page__header">
        <div>
          <p class="ao-page__eyebrow text-caption text-secondary">Продажи</p>
          <h1 class="ao-page__title">Заказы</h1>
        </div>
      </header>

      <!-- ── Search + filter bar ─────────────────────────────────────────── -->
      <div class="ao-page__toolbar">
        <v-text-field
          v-model="searchQuery"
          placeholder="Поиск по телефону или имени…"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="ao-page__search"
          @update:model-value="onSearchChange"
        />
        <v-select
          v-model="statusFilter"
          :items="STATUS_FILTER_OPTIONS"
          item-value="value"
          item-title="title"
          label="Статус"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="ao-page__status-filter"
          @update:model-value="onStatusChange"
        />
        <span class="ao-page__count text-secondary">
          {{ store.total }} {{ pluralize(store.total, 'заказ', 'заказа', 'заказов') }}
        </span>
      </div>

      <!-- ── Data table ──────────────────────────────────────────────────── -->
      <v-card variant="outlined" class="ao-table-card">
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="store.items"
          :items-length="store.total"
          :loading="store.loading"
          :page="currentPage"
          item-value="id"
          class="ao-table"
          @update:options="onTableOptions"
          @click:row="onRowClick"
        >
          <!-- Cover -->
          <template #[`item.magazineType`]="{ item }">
            <div class="ao-table__cover-row">
              <div class="ao-table__cover">
                <img
                  v-if="item.magazineType.coverImage"
                  :src="item.magazineType.coverImage"
                  :alt="item.magazineType.name"
                  class="ao-table__cover-img"
                />
                <div v-else class="ao-table__cover-placeholder">
                  <v-icon size="16" color="textMuted">mdi-book-open-outline</v-icon>
                </div>
              </div>
              <span class="ao-table__magazine-name">{{ item.magazineType.name }}</span>
            </div>
          </template>

          <!-- Customer -->
          <template #[`item.user`]="{ item }">
            <div class="ao-table__customer">
              <span class="ao-table__customer-name">{{ item.user.name || 'Без имени' }}</span>
              <span class="ao-table__customer-phone">{{ item.user.phone || '—' }}</span>
            </div>
          </template>

          <!-- Status -->
          <template #[`item.status`]="{ item }">
            <v-chip :color="STATUS_COLORS[item.status]" size="small" variant="tonal" label>
              {{ STATUS_LABELS[item.status] }}
            </v-chip>
          </template>

          <!-- totalPrice -->
          <template #[`item.totalPrice`]="{ item }">
            <span class="ao-table__price">{{ formatPrice(item.totalPrice) }}</span>
          </template>

          <!-- submittedAt -->
          <template #[`item.submittedAt`]="{ item }">
            <span class="ao-table__date">{{ formatDate(item.submittedAt ?? item.createdAt) }}</span>
          </template>

          <!-- Actions -->
          <template #[`item.actions`]="{ item }">
            <div class="ao-table__actions">
              <v-btn
                icon="mdi-eye-outline"
                size="small"
                variant="text"
                aria-label="Просмотреть заказ"
                @click.stop="openDetail(item)"
              />
            </div>
          </template>

          <!-- Loading skeleton -->
          <template #loading>
            <div class="ao-table__skeletons">
              <v-skeleton-loader v-for="n in 5" :key="n" type="table-row" />
            </div>
          </template>

          <!-- Empty -->
          <template #no-data>
            <div class="ao-table__empty">
              <v-icon size="40" color="textDisabled">mdi-package-variant-closed</v-icon>
              <p>{{ searchQuery || statusFilter ? 'Ничего не найдено' : 'Заказов пока нет' }}</p>
              <span v-if="!searchQuery && !statusFilter">Здесь появятся заказы, оформленные покупателями</span>
            </div>
          </template>
        </v-data-table-server>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminOrdersStore } from '../stores/orders.store'
import type { AdminOrderListItem, AdminOrderStatus } from '@/shared/api/admin/orders.api'

const store = useAdminOrdersStore()
const router = useRouter()

// ── Labels ───────────────────────────────────────────────────────────────────

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

const STATUS_FILTER_OPTIONS = (Object.keys(STATUS_LABELS) as AdminOrderStatus[])
  .filter((status) => status !== 'DRAFT')
  .map((status) => ({ value: status, title: STATUS_LABELS[status] }))

// ── Table options ────────────────────────────────────────────────────────────

const headers = [
  { title: 'Журнал', key: 'magazineType', sortable: false },
  { title: 'Покупатель', key: 'user', sortable: false },
  { title: 'Статус', key: 'status', sortable: false, width: 150 },
  { title: 'Сумма', key: 'totalPrice', sortable: true, width: 110 },
  { title: 'Оформлен', key: 'submittedAt', sortable: true, width: 120 },
  { title: '', key: 'actions', sortable: false, width: 64, align: 'end' as const },
]

const currentPage = ref(1)
const itemsPerPage = ref(20)
const searchQuery = ref('')
const statusFilter = ref<AdminOrderStatus | null>(null)
const sortBy = ref<'createdAt' | 'submittedAt' | 'totalPrice'>('submittedAt')
const sortDir = ref<'asc' | 'desc'>('desc')

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function onSearchChange() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchData()
  }, 350)
}

function onStatusChange() {
  currentPage.value = 1
  fetchData()
}

function onTableOptions(opts: {
  page: number
  itemsPerPage: number
  sortBy: { key: string; order: 'asc' | 'desc' }[]
}) {
  currentPage.value = opts.page
  itemsPerPage.value = opts.itemsPerPage
  if (opts.sortBy.length) {
    sortBy.value = opts.sortBy[0].key as typeof sortBy.value
    sortDir.value = opts.sortBy[0].order
  }
  fetchData()
}

function fetchData() {
  store.loadOrders({
    page: currentPage.value,
    limit: itemsPerPage.value,
    search: searchQuery.value || undefined,
    status: statusFilter.value ?? undefined,
    sortBy: sortBy.value,
    sortOrder: sortDir.value,
  })
}

onMounted(() => fetchData())

function openDetail(item: AdminOrderListItem): void {
  void router.push({ name: 'admin-order-detail', params: { id: item.id } })
}

function onRowClick(_event: unknown, row: { item: AdminOrderListItem }): void {
  openDetail(row.item)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
</script>

<style scoped lang="scss">
.ao-page {
  min-height: 100%;
}

.ao-page__inner {
  @include page-container;
  max-width: 1200px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.ao-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-4;
}

.ao-page__eyebrow {
  margin-bottom: $spacing-1;
}

.ao-page__title {
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.ao-page__toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  flex-wrap: wrap;
}

.ao-page__search {
  flex: 1;
  max-width: 320px;
  min-width: 200px;
}

.ao-page__status-filter {
  max-width: 220px;
  min-width: 160px;
}

.ao-page__count {
  font-size: $font-size-body-sm;
  white-space: nowrap;
}

.ao-table-card {
  border-color: $border-light !important;
  overflow: hidden;
}

.ao-table {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;

  :deep(tbody tr) {
    cursor: pointer;
  }
}

.ao-table__cover-row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.ao-table__cover {
  width: 32px;
  height: 42px;
  border-radius: $radius-xs;
  overflow: hidden;
  background: $bg-tertiary;
  flex-shrink: 0;

  &-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.ao-table__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ao-table__magazine-name {
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.ao-table__customer {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ao-table__customer-name {
  color: $text-primary;
}

.ao-table__customer-phone {
  font-size: $font-size-caption;
  color: $text-muted;
}

.ao-table__price {
  font-variant-numeric: tabular-nums;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
}

.ao-table__date {
  font-size: $font-size-caption;
  color: $text-muted;
  white-space: nowrap;
}

.ao-table__actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.ao-table__skeletons {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.ao-table__empty {
  padding: $spacing-12;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  text-align: center;

  p {
    font-family: $font-family-body;
    font-size: $font-size-body;
    font-weight: $font-weight-medium;
    color: $text-primary;
    margin: 0;
  }

  span {
    font-size: $font-size-body-sm;
    color: $text-muted;
  }
}
</style>
