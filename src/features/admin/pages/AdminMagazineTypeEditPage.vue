<template>
  <div class="mt-edit-page">
    <div class="mt-edit-page__inner">
      <header class="mt-edit-page__header">
        <div>
          <router-link :to="{ name: 'admin-magazine-types' }" class="mt-edit-page__back">
            <v-icon size="16">mdi-arrow-left</v-icon>
            Типы журналов
          </router-link>
          <h1 class="mt-edit-page__title">{{ form.name || 'Редактирование типа' }}</h1>
        </div>
        <v-chip v-if="form.isActive" color="success" size="small" variant="tonal" label>Активен</v-chip>
      </header>

      <v-tabs v-model="activeTab" color="primary" class="mt-edit-page__tabs">
        <v-tab value="general">Общие сведения</v-tab>
        <v-tab value="price">Цена</v-tab>
        <v-tab value="seo">SEO</v-tab>
        <v-tab value="image">Изображение</v-tab>
        <v-tab value="discounts">Скидки</v-tab>
        <v-tab value="pages">Страницы журнала</v-tab>
        <v-tab value="default-spreads">Развороты по умолчанию</v-tab>
      </v-tabs>

      <v-window v-model="activeTab" class="mt-edit-page__window">
        <v-window-item value="general">
          <v-card variant="outlined" class="mt-edit-page__card">
            <v-card-text class="mt-edit-page__form">
              <v-text-field v-model="form.name" label="Название *" variant="outlined" />
              <v-text-field v-model="form.slug" label="Slug *" variant="outlined" />
              <v-textarea v-model="form.description" label="Описание" variant="outlined" rows="3" />
              <v-text-field v-model.number="form.sortOrder" label="Порядок" type="number" variant="outlined" />
              <v-switch v-model="form.isActive" label="Активен" color="primary" hide-details />
              <v-btn color="primary" :loading="saving" @click="saveGeneral">Сохранить</v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item value="price">
          <v-card variant="outlined" class="mt-edit-page__card">
            <v-card-text class="mt-edit-page__form">
              <v-text-field v-model.number="form.basePrice" label="Цена, ₽" type="number" variant="outlined" />
              <v-text-field v-model.number="form.oldPrice" label="Старая цена, ₽" type="number" variant="outlined" />
              <v-btn color="primary" :loading="saving" @click="savePrice">Сохранить</v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item value="seo">
          <v-card variant="outlined" class="mt-edit-page__card">
            <v-card-text class="mt-edit-page__form">
              <v-text-field v-model="form.seoTitle" label="SEO заголовок" variant="outlined" />
              <v-textarea v-model="form.seoDescription" label="SEO описание" variant="outlined" rows="3" />
              <v-btn color="primary" :loading="saving" @click="saveSeo">Сохранить</v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item value="image">
          <v-card variant="outlined" class="mt-edit-page__card">
            <v-card-text class="mt-edit-page__form">
              <ImageUploader v-model="form.coverImage" />
              <v-btn color="primary" :loading="saving" @click="saveImage">Сохранить</v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item value="discounts">
          <v-card variant="outlined" class="mt-edit-page__card">
            <v-card-text class="mt-edit-page__form">
              <v-select
                v-model="form.badgeType"
                :items="badgeOptions"
                item-title="title"
                item-value="value"
                label="Тип бейджа"
                variant="outlined"
                clearable
              />
              <v-text-field v-model="form.badgeText" label="Текст бейджа" variant="outlined" />
              <v-btn color="primary" :loading="saving" @click="saveDiscounts">Сохранить</v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item value="pages">
          <MagazineTypePagesTab :magazine-type-id="magazineTypeId" />
        </v-window-item>

        <v-window-item value="default-spreads">
          <MagazineTypeDefaultSpreadsTab :magazine-type-id="magazineTypeId" />
        </v-window-item>
      </v-window>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import MagazineTypeDefaultSpreadsTab from '@/features/admin/components/MagazineTypeDefaultSpreadsTab.vue'
import MagazineTypePagesTab from '@/features/admin/components/MagazineTypePagesTab.vue'
import { useMagazineTypesStore } from '@/features/admin/stores/magazine-types.store'
import ImageUploader from '@/components/ImageUploader.vue'
import { adminMagazineTypesApi, type BadgeType } from '@/shared/api/admin/magazine-types.api'

const route = useRoute()
const store = useMagazineTypesStore()
const magazineTypeId = route.params.id as string
const activeTab = ref((route.query.tab as string) || 'general')
const saving = ref(false)

const badgeOptions = [
  { value: 'TOP' as BadgeType, title: 'Топ продаж' },
  { value: 'NEW' as BadgeType, title: 'Новинка' },
  { value: 'SALE' as BadgeType, title: 'Скидка' },
  { value: 'POPULAR' as BadgeType, title: 'Популярный' },
  { value: 'LIMITED' as BadgeType, title: 'Ограниченная серия' },
]

const form = reactive({
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

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === 'string' && tab) {
      activeTab.value = tab
    }
  },
)

function notify(text: string, color: 'success' | 'error'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function fillForm(item: Awaited<ReturnType<typeof adminMagazineTypesApi.getOne>>): void {
  form.name = item.name
  form.slug = item.slug
  form.description = item.description ?? ''
  form.coverImage = item.coverImage ?? null
  form.basePrice = item.basePrice != null ? Number(item.basePrice) : null
  form.oldPrice = item.oldPrice != null ? Number(item.oldPrice) : null
  form.badgeType = item.badgeType ?? null
  form.badgeText = item.badgeText ?? ''
  form.isActive = item.isActive
  form.sortOrder = item.sortOrder
  form.seoTitle = item.seoTitle ?? ''
  form.seoDescription = item.seoDescription ?? ''
}

async function loadType(): Promise<void> {
  const item = await adminMagazineTypesApi.getOne(magazineTypeId)
  fillForm(item)
}

async function savePatch(payload: Record<string, unknown>): Promise<void> {
  saving.value = true
  try {
    await store.updateMagazineType(magazineTypeId, payload)
    notify('Сохранено', 'success')
  } catch {
    notify('Ошибка сохранения', 'error')
  } finally {
    saving.value = false
  }
}

function saveGeneral(): Promise<void> {
  return savePatch({
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || undefined,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
  })
}

function savePrice(): Promise<void> {
  return savePatch({
    basePrice: form.basePrice ?? undefined,
    oldPrice: form.oldPrice ?? undefined,
  })
}

function saveSeo(): Promise<void> {
  return savePatch({
    seoTitle: form.seoTitle.trim() || undefined,
    seoDescription: form.seoDescription.trim() || undefined,
  })
}

function saveImage(): Promise<void> {
  return savePatch({
    coverImage: form.coverImage || undefined,
  })
}

function saveDiscounts(): Promise<void> {
  return savePatch({
    badgeType: form.badgeType ?? undefined,
    badgeText: form.badgeText.trim() || undefined,
  })
}

onMounted(() => {
  void loadType()
})
</script>

<style scoped lang="scss">
.mt-edit-page__inner {
  @include page-container;
  padding-top: $spacing-8;
  padding-bottom: $spacing-12;
}

.mt-edit-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
  margin-bottom: $spacing-6;
}

.mt-edit-page__back {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  margin-bottom: $spacing-2;
  color: $text-secondary;
  text-decoration: none;
  font-size: $font-size-body-sm;
}

.mt-edit-page__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-h3;
}

.mt-edit-page__tabs {
  margin-bottom: $spacing-4;
}

.mt-edit-page__card {
  padding: $spacing-2;
}

.mt-edit-page__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  max-width: 560px;
}
</style>
