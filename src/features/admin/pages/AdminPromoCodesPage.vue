<template>
  <div class="pc-page">
    <div class="pc-page__inner">

      <!-- ── Page header ─────────────────────────────────────────────────── -->
      <header class="pc-page__header">
        <div>
          <p class="pc-page__eyebrow text-caption text-secondary">Заказы</p>
          <h1 class="pc-page__title">Промокоды</h1>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="pc-page__create-btn"
          @click="openCreate"
        >
          Создать промокод
        </v-btn>
      </header>

      <!-- ── Search bar ──────────────────────────────────────────────────── -->
      <div class="pc-page__toolbar">
        <v-text-field
          v-model="searchQuery"
          placeholder="Поиск по коду…"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="pc-page__search"
          @update:model-value="onSearchChange"
        />
        <span class="pc-page__count text-secondary">
          {{ store.total }} {{ pluralize(store.total, 'промокод', 'промокода', 'промокодов') }}
        </span>
      </div>

      <!-- ── Data table ──────────────────────────────────────────────────── -->
      <v-card variant="outlined" class="pc-table-card">
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="store.items"
          :items-length="store.total"
          :loading="store.loading"
          :page="currentPage"
          item-value="id"
          class="pc-table"
          @update:options="onTableOptions"
        >
          <!-- Code -->
          <template #[`item.code`]="{ item }">
            <code class="pc-table__code">{{ item.code }}</code>
          </template>

          <!-- Discount -->
          <template #[`item.discount`]="{ item }">
            <span class="pc-table__discount">{{ formatDiscount(item) }}</span>
          </template>

          <!-- isActive -->
          <template #[`item.isActive`]="{ item }">
            <v-chip :color="item.isActive ? 'success' : 'default'" size="small" variant="tonal" label>
              {{ item.isActive ? 'Активен' : 'Отключен' }}
            </v-chip>
          </template>

          <!-- Usage -->
          <template #[`item.usage`]="{ item }">
            <span class="pc-table__usage">
              {{ item.usageCount }}{{ item.usageLimit != null ? ` / ${item.usageLimit}` : '' }}
            </span>
          </template>

          <!-- expiresAt -->
          <template #[`item.expiresAt`]="{ item }">
            <span v-if="item.expiresAt" class="pc-table__date">{{ formatDate(item.expiresAt) }}</span>
            <span v-else class="pc-table__date--empty">Бессрочно</span>
          </template>

          <!-- createdAt -->
          <template #[`item.createdAt`]="{ item }">
            <span class="pc-table__date">{{ formatDate(item.createdAt) }}</span>
          </template>

          <!-- Actions -->
          <template #[`item.actions`]="{ item }">
            <div class="pc-table__actions">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                :aria-label="`Редактировать ${item.code}`"
                @click="openEdit(item)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                :aria-label="`Удалить ${item.code}`"
                @click="openDelete(item)"
              />
            </div>
          </template>

          <!-- Loading skeleton -->
          <template #loading>
            <div class="pc-table__skeletons">
              <v-skeleton-loader v-for="n in 5" :key="n" type="table-row" />
            </div>
          </template>

          <!-- Empty -->
          <template #no-data>
            <div class="pc-table__empty">
              <v-icon size="40" color="textDisabled">mdi-ticket-percent-outline</v-icon>
              <p>{{ searchQuery ? 'Ничего не найдено' : 'Нет промокодов' }}</p>
              <span v-if="!searchQuery">Нажмите «Создать промокод», чтобы добавить первый</span>
            </div>
          </template>
        </v-data-table-server>
      </v-card>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         Create / Edit Dialog
    ═══════════════════════════════════════════════════════════════════════ -->
    <v-dialog v-model="formDialog.open" max-width="480" scrollable>
      <v-card class="pc-dialog">
        <v-card-title class="pc-dialog__title">
          {{ formDialog.editId ? 'Редактировать промокод' : 'Создать промокод' }}
        </v-card-title>

        <v-divider />

        <v-card-text class="pc-dialog__body">
          <v-form ref="formRef" @submit.prevent="submitForm">
            <div class="pc-form">
              <v-text-field
                v-model="form.code"
                label="Код *"
                placeholder="PAGES10"
                variant="outlined"
                density="comfortable"
                :rules="[required]"
                :error-messages="formErrors.code"
                hide-details="auto"
                @update:model-value="(v: string) => (form.code = v.toUpperCase())"
              />

              <div class="pc-form__row">
                <v-select
                  v-model="form.discountType"
                  :items="DISCOUNT_TYPE_OPTIONS"
                  item-value="value"
                  item-title="title"
                  label="Тип скидки"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  class="pc-form__type-field"
                />
                <v-text-field
                  v-model.number="form.discountValue"
                  :label="form.discountType === 'PERCENT' ? 'Скидка, %' : 'Скидка, ₽'"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="0"
                  :max="form.discountType === 'PERCENT' ? 100 : undefined"
                  :rules="[minNum(0.01)]"
                  :error-messages="formErrors.discountValue"
                  hide-details="auto"
                  class="pc-form__value-field"
                />
              </div>

              <v-text-field
                v-model="form.expiresAt"
                label="Действует до"
                variant="outlined"
                density="comfortable"
                type="date"
                hint="Оставьте пустым для бессрочного промокода"
                persistent-hint
              />

              <v-text-field
                v-model.number="form.usageLimit"
                label="Лимит использований"
                variant="outlined"
                density="comfortable"
                type="number"
                min="1"
                hint="Оставьте пустым для неограниченного количества"
                persistent-hint
              />

              <v-switch
                v-model="form.isActive"
                label="Активен"
                color="primary"
                inset
                hide-details
              />
            </div>
          </v-form>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pc-dialog__actions">
          <v-btn variant="text" :disabled="formDialog.saving" @click="formDialog.open = false">
            Отмена
          </v-btn>
          <v-spacer />
          <v-btn color="primary" :loading="formDialog.saving" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════════════════════════════════════════════════════════════════
         Delete confirmation dialog
    ═══════════════════════════════════════════════════════════════════════ -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card class="pc-dialog">
        <v-card-title class="pc-dialog__title">Удалить промокод?</v-card-title>
        <v-card-text class="pc-dialog__body">
          <p>
            Вы действительно хотите удалить
            <strong>«{{ deleteDialog.item?.code }}»</strong>?
          </p>
        </v-card-text>
        <v-card-actions class="pc-dialog__actions">
          <v-btn variant="text" :disabled="deleteDialog.deleting" @click="deleteDialog.open = false">
            Отмена
          </v-btn>
          <v-spacer />
          <v-btn color="error" :loading="deleteDialog.deleting" @click="confirmDelete">
            Удалить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── Snackbar ────────────────────────────────────────────────────────── -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="bottom right"
      :timeout="3500"
      rounded="lg"
    >
      {{ snackbar.text }}
      <template #actions>
        <v-btn variant="text" size="small" @click="snackbar.show = false">✕</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { usePromoCodesStore } from '../stores/promo-codes.store'
import type { AdminPromoCode, PromoCodeDiscountType } from '@/shared/api/admin/promo-codes.api'

const store = usePromoCodesStore()

// ── Table options ────────────────────────────────────────────────────────────

const headers = [
  { title: 'Код', key: 'code', sortable: true },
  { title: 'Скидка', key: 'discount', sortable: false, width: 110 },
  { title: 'Статус', key: 'isActive', sortable: false, width: 110 },
  { title: 'Использовано', key: 'usage', sortable: true, width: 130 },
  { title: 'Действует до', key: 'expiresAt', sortable: true, width: 130 },
  { title: 'Создан', key: 'createdAt', sortable: true, width: 120 },
  { title: '', key: 'actions', sortable: false, width: 96, align: 'end' as const },
]

const DISCOUNT_TYPE_OPTIONS: { value: PromoCodeDiscountType; title: string }[] = [
  { value: 'PERCENT', title: 'Процент' },
  { value: 'AMOUNT', title: 'Фиксированная сумма' },
]

const currentPage = ref(1)
const itemsPerPage = ref(20)
const searchQuery = ref('')
const sortBy = ref<'code' | 'createdAt' | 'expiresAt' | 'usageCount'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function onSearchChange() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchData()
  }, 350)
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
  store.loadPromoCodes({
    page: currentPage.value,
    limit: itemsPerPage.value,
    search: searchQuery.value || undefined,
    sortBy: sortBy.value,
    sortOrder: sortDir.value,
  })
}

onMounted(() => fetchData())

// ── Form dialog ──────────────────────────────────────────────────────────────

const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const emptyForm = () => ({
  code: '',
  discountType: 'PERCENT' as PromoCodeDiscountType,
  discountValue: 10 as number | null,
  isActive: true,
  expiresAt: '' as string,
  usageLimit: null as number | null,
})

const form = reactive(emptyForm())
const formErrors = reactive({ code: '', discountValue: '' })
const formDialog = reactive({ open: false, editId: null as string | null, saving: false })

function openCreate() {
  Object.assign(form, emptyForm())
  formErrors.code = ''
  formErrors.discountValue = ''
  formDialog.editId = null
  formDialog.open = true
}

function openEdit(item: AdminPromoCode) {
  form.code = item.code
  form.discountType = item.discountPercent != null ? 'PERCENT' : 'AMOUNT'
  form.discountValue = item.discountPercent != null ? item.discountPercent : Number(item.discountAmount)
  form.isActive = item.isActive
  form.expiresAt = item.expiresAt ? item.expiresAt.slice(0, 10) : ''
  form.usageLimit = item.usageLimit
  formErrors.code = ''
  formErrors.discountValue = ''
  formDialog.editId = item.id
  formDialog.open = true
}

async function submitForm() {
  formErrors.code = ''
  formErrors.discountValue = ''

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  formDialog.saving = true
  try {
    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: form.discountValue ?? 0,
      isActive: form.isActive,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      usageLimit: form.usageLimit ?? undefined,
    }

    if (formDialog.editId) {
      await store.updatePromoCode(formDialog.editId, payload)
      notify('Промокод обновлён', 'success')
    } else {
      await store.createPromoCode(payload)
      notify('Промокод создан', 'success')
    }

    formDialog.open = false
    fetchData()
  } catch (err: unknown) {
    const msg = extractErrorMessage(err)
    if (msg.toLowerCase().includes('код') || msg.toLowerCase().includes('code')) {
      formErrors.code = msg
    } else {
      notify(msg || 'Ошибка при сохранении', 'error')
    }
  } finally {
    formDialog.saving = false
  }
}

// ── Delete dialog ────────────────────────────────────────────────────────────

const deleteDialog = reactive({
  open: false,
  item: null as AdminPromoCode | null,
  deleting: false,
})

function openDelete(item: AdminPromoCode) {
  deleteDialog.item = item
  deleteDialog.open = true
}

async function confirmDelete() {
  if (!deleteDialog.item) return
  deleteDialog.deleting = true
  try {
    await store.deletePromoCode(deleteDialog.item.id)
    notify('Промокод удалён', 'success')
    deleteDialog.open = false
  } catch (err: unknown) {
    notify(extractErrorMessage(err) || 'Ошибка при удалении', 'error')
  } finally {
    deleteDialog.deleting = false
  }
}

// ── Snackbar ─────────────────────────────────────────────────────────────────

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success') {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

// ── Validation rules ─────────────────────────────────────────────────────────

const required = (v: string) => !!v?.trim() || 'Обязательное поле'
const minNum = (n: number) => (v: number) => (v != null && v >= n) || `Минимальное значение ${n}`

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDiscount(item: AdminPromoCode): string {
  if (item.discountPercent != null) {
    return `${item.discountPercent}%`
  }
  if (item.discountAmount != null) {
    return `${priceFormatter.format(Number(item.discountAmount))} ₽`
  }
  return '—'
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'decimal',
  maximumFractionDigits: 0,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: string } }; message?: string }
    return e.response?.data?.message ?? e.message ?? ''
  }
  return ''
}
</script>

<style scoped lang="scss">
// ── Page ─────────────────────────────────────────────────────────────────────
.pc-page {
  min-height: 100%;
}

.pc-page__inner {
  @include page-container;
  max-width: 1200px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.pc-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-4;
}

.pc-page__eyebrow {
  margin-bottom: $spacing-1;
}

.pc-page__title {
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.pc-page__create-btn {
  align-self: center;
  text-transform: none;
  letter-spacing: $letter-spacing-button;
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
.pc-page__toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  flex-wrap: wrap;
}

.pc-page__search {
  flex: 1;
  max-width: 360px;
  min-width: 200px;
}

.pc-page__count {
  font-size: $font-size-body-sm;
  white-space: nowrap;
}

// ── Table card ────────────────────────────────────────────────────────────────
.pc-table-card {
  border-color: $border-light !important;
  overflow: hidden;
}

.pc-table {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
}

.pc-table__code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: $font-weight-medium;
  background: $bg-tertiary;
  padding: 2px 8px;
  border-radius: $radius-xs;
  color: $text-primary;
}

.pc-table__discount {
  font-variant-numeric: tabular-nums;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.pc-table__usage {
  font-variant-numeric: tabular-nums;
  color: $text-secondary;
}

.pc-table__date {
  font-size: $font-size-caption;
  color: $text-muted;
  white-space: nowrap;
}

.pc-table__date--empty {
  font-size: $font-size-caption;
  color: $text-disabled;
}

.pc-table__actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.pc-table__skeletons {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.pc-table__empty {
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

// ── Dialog ────────────────────────────────────────────────────────────────────
.pc-dialog__title {
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-subheading;
  padding: $spacing-6 $spacing-8;
}

.pc-dialog__body {
  padding: $spacing-6 $spacing-8;
}

.pc-dialog__actions {
  padding: $spacing-4 $spacing-8;
}

// ── Form ──────────────────────────────────────────────────────────────────────
.pc-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.pc-form__row {
  display: flex;
  gap: $spacing-4;
}

.pc-form__type-field {
  flex: 1;
  min-width: 160px;
}

.pc-form__value-field {
  flex: 1;
  min-width: 120px;
}
</style>
