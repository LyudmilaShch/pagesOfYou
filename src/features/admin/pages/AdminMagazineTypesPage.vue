<template>
  <div class="mt-page">
    <div class="mt-page__inner">

      <!-- ── Page header ─────────────────────────────────────────────────── -->
      <header class="mt-page__header">
        <div>
          <p class="mt-page__eyebrow text-caption text-secondary">Каталог</p>
          <h1 class="mt-page__title">Типы журналов</h1>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="mt-page__create-btn"
          @click="openCreate"
        >
          Создать тип
        </v-btn>
      </header>

      <!-- ── Search + filter bar ─────────────────────────────────────────── -->
      <div class="mt-page__toolbar">
        <v-text-field
          v-model="searchQuery"
          placeholder="Поиск по названию…"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="mt-page__search"
          @update:model-value="onSearchChange"
        />
        <span class="mt-page__count text-secondary">
          {{ store.total }} {{ pluralize(store.total, 'тип', 'типа', 'типов') }}
        </span>
      </div>

      <!-- ── Data table ──────────────────────────────────────────────────── -->
      <v-card variant="outlined" class="mt-table-card">
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="store.items"
          :items-length="store.total"
          :loading="store.loading"
          :page="currentPage"
          item-value="id"
          class="mt-table"
          @update:options="onTableOptions"
        >
          <!-- Cover image -->
          <template #[`item.coverImage`]="{ item }">
            <div class="mt-table__cover">
              <img
                v-if="item.coverImage"
                :src="item.coverImage"
                :alt="item.name"
                class="mt-table__cover-img"
              />
              <div v-else class="mt-table__cover-placeholder">
                <v-icon size="16" color="textMuted">mdi-image-outline</v-icon>
              </div>
            </div>
          </template>

          <!-- Name -->
          <template #[`item.name`]="{ item }">
            <span class="mt-table__name">{{ item.name }}</span>
          </template>

          <!-- Slug -->
          <template #[`item.slug`]="{ item }">
            <code class="mt-table__slug">{{ item.slug }}</code>
          </template>

          <!-- basePrice -->
          <template #[`item.basePrice`]="{ item }">
            <span v-if="item.basePrice != null" class="mt-table__price">
              {{ formatPrice(item.basePrice) }}
            </span>
            <span v-else class="mt-table__price--empty">—</span>
          </template>

          <!-- oldPrice -->
          <template #[`item.oldPrice`]="{ item }">
            <span v-if="item.oldPrice != null" class="mt-table__old-price">
              {{ formatPrice(item.oldPrice) }}
            </span>
            <span v-else class="mt-table__price--empty">—</span>
          </template>

          <!-- badgeType -->
          <template #[`item.badgeType`]="{ item }">
            <v-chip
              v-if="item.badgeType"
              size="x-small"
              variant="tonal"
              :class="`mt-badge mt-badge--${item.badgeType.toLowerCase()}`"
              label
            >
              {{ item.badgeText || BADGE_LABELS[item.badgeType as BadgeType] }}
            </v-chip>
            <span v-else class="mt-table__price--empty">—</span>
          </template>

          <!-- isActive -->
          <template #[`item.isActive`]="{ item }">
            <v-chip
              :color="item.isActive ? 'success' : 'default'"
              size="small"
              variant="tonal"
              label
            >
              {{ item.isActive ? 'Активен' : 'Скрыт' }}
            </v-chip>
          </template>

          <!-- sortOrder -->
          <template #[`item.sortOrder`]="{ item }">
            <span class="mt-table__order">{{ item.sortOrder }}</span>
          </template>

          <!-- createdAt -->
          <template #[`item.createdAt`]="{ item }">
            <span class="mt-table__date">{{ formatDate(item.createdAt) }}</span>
          </template>

          <!-- Actions -->
          <template #[`item.actions`]="{ item }">
            <div class="mt-table__actions">
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                :aria-label="`Редактировать ${item.name}`"
                @click="openEdit(item)"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                :aria-label="`Удалить ${item.name}`"
                @click="openDelete(item)"
              />
            </div>
          </template>

          <!-- Loading skeleton -->
          <template #loading>
            <div class="mt-table__skeletons">
              <v-skeleton-loader v-for="n in 5" :key="n" type="table-row" />
            </div>
          </template>

          <!-- Empty -->
          <template #no-data>
            <div class="mt-table__empty">
              <v-icon size="40" color="textDisabled">mdi-book-open-outline</v-icon>
              <p>{{ searchQuery ? 'Ничего не найдено' : 'Нет типов журналов' }}</p>
              <span v-if="!searchQuery">Нажмите «Создать тип», чтобы добавить первый</span>
            </div>
          </template>
        </v-data-table-server>
      </v-card>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         Create / Edit Dialog
    ═══════════════════════════════════════════════════════════════════════ -->
    <v-dialog v-model="formDialog.open" max-width="640" scrollable>
      <v-card class="mt-dialog">
        <v-card-title class="mt-dialog__title">
          {{ formDialog.editId ? 'Редактировать тип' : 'Создать тип журнала' }}
        </v-card-title>

        <v-divider />

        <v-card-text class="mt-dialog__body">
          <v-form ref="formRef" @submit.prevent="submitForm">
            <div class="mt-form">

              <!-- Name -->
              <v-text-field
                v-model="form.name"
                label="Название *"
                variant="outlined"
                density="comfortable"
                :rules="[required, minLen(2)]"
                :error-messages="formErrors.name"
                hide-details="auto"
                @update:model-value="autoSlug"
              />

              <!-- Slug -->
              <v-text-field
                v-model="form.slug"
                label="Slug *"
                variant="outlined"
                density="comfortable"
                placeholder="friend"
                hint="Только строчные буквы, цифры и дефисы"
                :rules="[required, slugRule]"
                :error-messages="formErrors.slug"
                hide-details="auto"
              />

              <!-- Description -->
              <v-textarea
                v-model="form.description"
                label="Описание"
                variant="outlined"
                density="comfortable"
                rows="3"
                auto-grow
                hide-details="auto"
              />

              <!-- Cover image upload -->
              <div class="mt-form__uploader">
                <p class="mt-form__uploader-label">Обложка</p>
                <ImageUploader
                  :key="formDialog.open ? (formDialog.editId ?? 'new') : 'closed'"
                  v-model="form.coverImage"
                />
              </div>

              <!-- Base price -->
              <v-text-field
                v-model.number="form.basePrice"
                label="Базовая цена, ₽"
                variant="outlined"
                density="comfortable"
                type="number"
                min="0"
                step="100"
                placeholder="4900"
                :hint="form.basePrice ? `Отображается как: от ${formatPrice(form.basePrice)}` : 'Оставьте пустым, если цена не задана'"
                :rules="[minNum(0)]"
                prepend-inner-icon="mdi-currency-rub"
                hide-details="auto"
              />

              <!-- Old price + badge type row -->
              <div class="mt-form__row mt-form__row--prices">
                <v-text-field
                  v-model.number="form.oldPrice"
                  label="Старая цена, ₽"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="7900"
                  hint="Если задана — отображается перечеркнутой"
                  :rules="[minNum(0)]"
                  prepend-inner-icon="mdi-currency-rub"
                  hide-details="auto"
                  class="mt-form__price-field"
                />
                <v-select
                  v-model="form.badgeType"
                  :items="BADGE_OPTIONS"
                  item-value="value"
                  item-title="title"
                  label="Тип бейджа"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  hide-details="auto"
                  class="mt-form__badge-field"
                />
              </div>

              <!-- Badge text -->
              <v-text-field
                v-model="form.badgeText"
                label="Текст бейджа"
                variant="outlined"
                density="comfortable"
                placeholder="Хит сезона, -20%, Лучшая цена…"
                hint="Если не заполнено — используется стандартный текст типа"
                :disabled="!form.badgeType"
                maxlength="50"
                counter="50"
                hide-details="auto"
              />

              <!-- sortOrder + isActive row -->
              <div class="mt-form__row">
                <v-text-field
                  v-model.number="form.sortOrder"
                  label="Порядок сортировки"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="0"
                  :rules="[minNum(0)]"
                  hide-details="auto"
                  class="mt-form__order-field"
                />
                <v-switch
                  v-model="form.isActive"
                  label="Активен"
                  color="primary"
                  inset
                  hide-details
                  class="mt-form__switch"
                />
              </div>

              <v-divider class="my-1" />
              <p class="mt-form__section-label">SEO</p>

              <!-- SEO Title -->
              <v-text-field
                v-model="form.seoTitle"
                label="SEO Title"
                variant="outlined"
                density="comfortable"
                counter="200"
                maxlength="200"
                hide-details="auto"
              />

              <!-- SEO Description -->
              <v-textarea
                v-model="form.seoDescription"
                label="SEO Description"
                variant="outlined"
                density="comfortable"
                rows="2"
                counter="500"
                maxlength="500"
                hide-details="auto"
              />
            </div>
          </v-form>
        </v-card-text>

        <v-divider />

        <v-card-actions class="mt-dialog__actions">
          <v-btn variant="text" :disabled="formDialog.saving" @click="formDialog.open = false">
            Отмена
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            :loading="formDialog.saving"
            @click="submitForm"
          >
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════════════════════════════════════════════════════════════════
         Delete confirmation dialog
    ═══════════════════════════════════════════════════════════════════════ -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card class="mt-dialog">
        <v-card-title class="mt-dialog__title">Удалить тип журнала?</v-card-title>
        <v-card-text class="mt-dialog__body">
          <p>
            Вы действительно хотите удалить
            <strong>«{{ deleteDialog.item?.name }}»</strong>?
          </p>
          <p class="text-secondary" style="font-size:13px; margin-top: 8px;">
            Запись будет скрыта и не будет отображаться на сайте. Физического удаления не происходит.
          </p>
        </v-card-text>
        <v-card-actions class="mt-dialog__actions">
          <v-btn variant="text" :disabled="deleteDialog.deleting" @click="deleteDialog.open = false">
            Отмена
          </v-btn>
          <v-spacer />
          <v-btn
            color="error"
            :loading="deleteDialog.deleting"
            @click="confirmDelete"
          >
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
import { useRouter } from 'vue-router'
import { useMagazineTypesStore } from '../stores/magazine-types.store'
import type { AdminMagazineType } from '@/shared/api/admin/magazine-types.api'
import ImageUploader from '@/components/ImageUploader.vue'
import type { BadgeType } from '@/shared/api/admin/magazine-types.api'

const store = useMagazineTypesStore()
const router = useRouter()

// ── Table options ────────────────────────────────────────────────────────────

const headers = [
  { title: '', key: 'coverImage', sortable: false, width: 56 },
  { title: 'Название', key: 'name', sortable: true },
  { title: 'Slug', key: 'slug', sortable: false },
  { title: 'Цена', key: 'basePrice', sortable: true, width: 110 },
  { title: 'Старая цена', key: 'oldPrice', sortable: false, width: 110 },
  { title: 'Бейдж', key: 'badgeType', sortable: false, width: 130 },
  { title: 'Активен', key: 'isActive', sortable: false, width: 110 },
  { title: 'Порядок', key: 'sortOrder', sortable: true, width: 90 },
  { title: 'Создан', key: 'createdAt', sortable: true, width: 120 },
  { title: '', key: 'actions', sortable: false, width: 96, align: 'end' as const },
]

const BADGE_OPTIONS: { value: BadgeType; title: string }[] = [
  { value: 'TOP', title: 'Топ продаж' },
  { value: 'NEW', title: 'Новинка' },
  { value: 'SALE', title: 'Скидка' },
  { value: 'POPULAR', title: 'Популярный' },
  { value: 'LIMITED', title: 'Ограниченная серия' },
]

const BADGE_LABELS: Record<BadgeType, string> = {
  TOP: 'Топ продаж',
  NEW: 'Новинка',
  SALE: 'Скидка',
  POPULAR: 'Популярный',
  LIMITED: 'Ограниченная серия',
}

const currentPage = ref(1)
const itemsPerPage = ref(20)
const searchQuery = ref('')
const sortBy = ref<'name' | 'sortOrder' | 'createdAt'>('sortOrder')
const sortDir = ref<'asc' | 'desc'>('asc')

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
  store.loadMagazineTypes({
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
  name: '',
  slug: '',
  description: '',
  coverImage: null as string | null,
  basePrice: null as number | null,
  oldPrice: null as number | null,
  badgeType: null as BadgeType | null,
  badgeText: '',
  isActive: true,
  sortOrder: 0,
  seoTitle: '',
  seoDescription: '',
})

const form = reactive(emptyForm())
const formErrors = reactive({ name: '', slug: '' })
const formDialog = reactive({ open: false, editId: null as string | null, saving: false })

function openCreate() {
  Object.assign(form, emptyForm())
  formErrors.name = ''
  formErrors.slug = ''
  formDialog.editId = null
  formDialog.open = true
}

function openEdit(item: AdminMagazineType) {
  void router.push({ name: 'admin-magazine-type-edit', params: { id: item.id } })
}

function autoSlug() {
  if (formDialog.editId) return // don't auto-change slug when editing
  form.slug = form.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function submitForm() {
  formErrors.name = ''
  formErrors.slug = ''

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  formDialog.saving = true
  try {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      coverImage: form.coverImage || undefined,
      basePrice: validNum(form.basePrice),
      oldPrice: validNum(form.oldPrice),
      badgeType: form.badgeType ?? undefined,
      badgeText: form.badgeText.trim() || undefined,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      seoTitle: form.seoTitle.trim() || undefined,
      seoDescription: form.seoDescription.trim() || undefined,
    }

    if (formDialog.editId) {
      await store.updateMagazineType(formDialog.editId, payload)
      notify('Тип журнала обновлён', 'success')
    } else {
      const created = await store.createMagazineType(payload)
      notify('Тип журнала создан', 'success')
      formDialog.open = false
      void router.push({ name: 'admin-magazine-type-edit', params: { id: created.id } })
      return
    }

    formDialog.open = false
    fetchData()
  } catch (err: unknown) {
    const msg = extractErrorMessage(err)
    if (msg.toLowerCase().includes('slug')) {
      formErrors.slug = msg
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
  item: null as AdminMagazineType | null,
  deleting: false,
})

function openDelete(item: AdminMagazineType) {
  deleteDialog.item = item
  deleteDialog.open = true
}

async function confirmDelete() {
  if (!deleteDialog.item) return
  deleteDialog.deleting = true
  try {
    await store.deleteMagazineType(deleteDialog.item.id)
    notify('Тип журнала удалён', 'success')
    deleteDialog.open = false
    fetchData()
  } catch {
    notify('Ошибка при удалении', 'error')
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
const minLen = (n: number) => (v: string) => v?.length >= n || `Минимум ${n} символа`
const minNum = (n: number) => (v: number) => v >= n || `Минимальное значение ${n}`
const slugRule = (v: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) || 'Только строчные буквы, цифры и дефисы'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a nullable/NaN number to a valid number for the API, or undefined */
function validNum(v: number | null | undefined): number | undefined {
  if (v == null || isNaN(v as number)) return undefined
  return v as number
}

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

function formatPrice(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
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
.mt-page {
  min-height: 100%;
}

.mt-page__inner {
  @include page-container;
  max-width: 1200px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.mt-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-4;
}

.mt-page__eyebrow {
  margin-bottom: $spacing-1;
}

.mt-page__title {
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin: 0;
}

.mt-page__create-btn {
  align-self: center;
  text-transform: none;
  letter-spacing: $letter-spacing-button;
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
.mt-page__toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  flex-wrap: wrap;
}

.mt-page__search {
  flex: 1;
  max-width: 360px;
  min-width: 200px;
}

.mt-page__count {
  font-size: $font-size-body-sm;
  white-space: nowrap;
}

// ── Table card ────────────────────────────────────────────────────────────────
.mt-table-card {
  border-color: $border-light !important;
  overflow: hidden;
}

.mt-table {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
}

.mt-table__cover {
  width: 36px;
  height: 48px;
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

.mt-table__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mt-table__name {
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.mt-table__slug {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: $bg-tertiary;
  padding: 2px 6px;
  border-radius: $radius-xs;
  color: $text-secondary;
}

.mt-table__price {
  font-variant-numeric: tabular-nums;
  font-weight: $font-weight-medium;
  color: $text-primary;
  white-space: nowrap;
}

.mt-table__price--empty {
  color: $text-muted;
}

.mt-table__old-price {
  font-variant-numeric: tabular-nums;
  color: $text-muted;
  text-decoration: line-through;
  white-space: nowrap;
  font-size: $font-size-caption;
}

// ── Badge chips in table ──────────────────────────────────────────────────────
.mt-badge {
  font-size: 10px !important;
  font-weight: $font-weight-bold !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  color: #fff !important;

  &--top     { background: #1A1A1A !important; }
  &--new     { background: #00875A !important; }
  &--sale    { background: #D32F2F !important; }
  &--popular { background: #E65100 !important; }
  &--limited { background: #6A1B9A !important; }
}

.mt-table__order {
  font-variant-numeric: tabular-nums;
  color: $text-muted;
}

.mt-table__date {
  font-size: $font-size-caption;
  color: $text-muted;
  white-space: nowrap;
}

.mt-table__actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.mt-table__skeletons {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.mt-table__empty {
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
.mt-dialog__title {
  font-family: $font-family-display;
  font-size: $font-size-h4;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-subheading;
  padding: $spacing-6 $spacing-8;
}

.mt-dialog__body {
  padding: $spacing-6 $spacing-8;
}

.mt-dialog__actions {
  padding: $spacing-4 $spacing-8;
}

// ── Form ──────────────────────────────────────────────────────────────────────
.mt-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.mt-form__row {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  flex-wrap: wrap;
}

.mt-form__order-field {
  max-width: 180px;
}

.mt-form__row--prices {
  align-items: flex-start;
}

.mt-form__price-field {
  flex: 1;
  min-width: 140px;
}

.mt-form__badge-field {
  flex: 1;
  min-width: 160px;
}

.mt-form__switch {
  flex-shrink: 0;
}

.mt-form__section-label {
  font-size: $font-size-caption;
  font-weight: $font-weight-semibold;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
  margin: 0;
}

// ── Image uploader wrapper ────────────────────────────────────────────────────
.mt-form__uploader {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.mt-form__uploader-label {
  font-size: $font-size-caption;
  font-weight: $font-weight-medium;
  color: $text-secondary;
  margin: 0;
}
</style>
