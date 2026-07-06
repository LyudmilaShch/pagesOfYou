<template>
  <div class="fill-order">
    <header class="fill-order__topbar">
      <div class="fill-order__topbar-inner">
        <router-link to="/order/create" class="fill-order__brand">Pages of You</router-link>
        <div class="fill-order__steps-label" aria-label="Шаг 2 из 3">
          <span class="fill-order__steps-current">2</span>
          <span>/</span>
          <span>3</span>
        </div>
      </div>
    </header>

    <main class="fill-order__main">
      <div class="fill-order__container">
        <header class="fill-order__intro">
          <p class="fill-order__eyebrow">Шаг 2 — Заполнение журнала</p>
          <h1 class="fill-order__title">{{ store.order?.magazineType.name ?? 'Ваш журнал' }}</h1>
          <p class="fill-order__subtitle">
            Слева — структура журнала: обложка, развороты и задняя обложка. Для каждого слота можно
            выбрать шаблон из админки — целый разворот или две страницы по отдельности. Развороты
            можно перетаскивать и добавлять.
          </p>
        </header>

        <v-alert v-if="store.orderError" type="error" variant="tonal" class="mb-4">
          {{ store.orderError }}
        </v-alert>

        <div v-if="store.isLoadingOrder" class="fill-order__loading">
          <v-progress-circular indeterminate color="primary" />
          <p>Загружаем страницы журнала…</p>
        </div>
      </div>

      <div v-if="store.order && !store.isLoadingOrder" class="fill-order__workspace">
        <OrderPagesSidebar
          :pages="store.order.journalPages"
          :current-index="store.currentPageIndex"
          @select="handleSelectPage"
          @pick-template="openTemplatePicker"
          @add-spread="handleAddSpread"
          @reorder="handleReorderSpreads"
        />

        <div class="fill-order__canvas-wrap">
          <OrderPageViewerCanvas
            v-if="store.currentJournalPage"
            :key="store.currentJournalPage.id"
            :fill-session="fillSession"
            :canvas-data="store.currentJournalPage.pageSnapshot"
            :placeholder-values="previewValues"
          />
        </div>

        <OrderPropertiesPanel
          v-if="store.currentJournalPage"
          :selected-element="selectedElement"
          :text-value="selectedTextValue"
          :photo-url="selectedPhotoUrl"
          :is-spread-page="isSpreadPage"
          :uploading="uploadingId === selectedElementId"
          :photo-crop-active="photoCropEditingElementId === selectedElementId"
          @patch-element="patchElement"
          @update-text="updateText"
          @upload-photo="(id, file) => uploadPhoto(id, file)"
          @clear-photo="clearPhoto"
          @start-photo-crop="startPhotoCropEditing"
          @stop-photo-crop="stopPhotoCropEditing"
          @align-to-page-center="alignSelectedToPageCenter"
        />
      </div>
    </main>

    <footer class="fill-order__actions">
      <div class="fill-order__actions-inner">
        <v-btn variant="outlined" size="large" :disabled="store.isSaving" @click="goBack">
          Назад
        </v-btn>

        <div class="fill-order__actions-right">
          <span v-if="store.isSaving" class="fill-order__saving">Сохранение…</span>
          <v-btn
            color="primary"
            size="large"
            :loading="store.isSubmitting"
            :disabled="store.isSaving"
            @click="handleSubmit"
          >
            Отправить заказ
          </v-btn>
        </div>
      </div>
    </footer>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>

    <JournalTemplatePickerDialog
      :open="templatePicker.open"
      :journal-page="templatePicker.page"
      :templates="store.groupedTemplates"
      :loading="store.isSaving"
      @close="closeTemplatePicker"
      @apply="handleApplyTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, toRef } from 'vue'
import { useRouter } from 'vue-router'

import OrderPageViewerCanvas from '../components/OrderPageViewerCanvas.vue'
import OrderPagesSidebar from '../components/OrderPagesSidebar.vue'
import OrderPropertiesPanel from '../components/OrderPropertiesPanel.vue'
import JournalTemplatePickerDialog from '../components/JournalTemplatePickerDialog.vue'
import { useOrderFillSession } from '../composables/useOrderFillSession'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import type { SetJournalPageTemplatePayload } from '../api/orders.api'
import type { JournalPage } from '../types/order.types'

const router = useRouter()
const store = useOrderBuilderStore()

const fillSession = useOrderFillSession({
  currentJournalPage: toRef(store, 'currentJournalPage'),
  isLocalDraft: toRef(store, 'isLocalDraft'),
})

const {
  selectedElementId,
  photoCropEditingElementId,
  selectedElement,
  previewValues,
  isSpreadPage,
  uploadingId,
  getTextValue,
  getPhotoUrl,
  getPayload,
  patchElement,
  alignSelectedToPageCenter,
  updateText,
  clearPhoto,
  uploadPhoto,
  startPhotoCropEditing,
  stopPhotoCropEditing,
  syncLocalValues,
} = fillSession

const selectedTextValue = computed(() =>
  selectedElement.value ? getTextValue(selectedElement.value.id) : '',
)

const selectedPhotoUrl = computed(() =>
  selectedElement.value ? getPhotoUrl(selectedElement.value.id) : undefined,
)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

const templatePicker = reactive<{
  open: boolean
  page: JournalPage | null
}>({
  open: false,
  page: null,
})

async function initialize(): Promise<void> {
  if (store.order) {
    return
  }

  const magazineTypeId = store.selectedMagazineType?.id ?? null

  if (!magazineTypeId) {
    await router.replace({ name: 'create-order' })
    return
  }

  try {
    await store.loadLocalDraft(magazineTypeId)
  } catch {
    await router.replace({ name: 'create-order' })
  }
}

async function persistCurrentPage(): Promise<void> {
  if (!store.currentJournalPage) {
    return
  }

  store.updateCurrentPageSnapshot(
    fillSession.applyDecorativeLayoutDrafts(store.currentJournalPage.pageSnapshot),
  )
  await store.saveCurrentPagePlaceholders(getPayload())
  syncLocalValues()
}

async function handleSelectPage(index: number): Promise<void> {
  if (index === store.currentPageIndex) {
    return
  }

  try {
    await persistCurrentPage()
    store.setCurrentPageIndex(index)
  } catch {
    snackbar.text = 'Не удалось сохранить страницу'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

function openTemplatePicker(journalPageId: string): void {
  const page = store.order?.journalPages.find((item) => item.id === journalPageId) ?? null
  templatePicker.page = page
  templatePicker.open = Boolean(page)
}

function closeTemplatePicker(): void {
  templatePicker.open = false
  templatePicker.page = null
}

async function handleApplyTemplate(payload: SetJournalPageTemplatePayload): Promise<void> {
  if (!templatePicker.page) {
    return
  }

  try {
    await persistCurrentPage()
    await store.setJournalPageTemplate(templatePicker.page.id, payload)
    closeTemplatePicker()
    snackbar.text = 'Шаблон применён'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось применить шаблон'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function handleAddSpread(): Promise<void> {
  try {
    await persistCurrentPage()
    await store.addJournalSpread()
    snackbar.text = 'Разворот добавлен'
    snackbar.color = 'success'
    snackbar.show = true
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось добавить разворот'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function handleReorderSpreads(spreadIds: string[]): Promise<void> {
  try {
    await store.reorderJournalSpreads(spreadIds)
  } catch {
    snackbar.text = store.orderError ?? 'Не удалось изменить порядок'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

function goBack(): void {
  void router.push({ name: 'create-order' })
}

async function handleSubmit(): Promise<void> {
  try {
    await persistCurrentPage()
    await store.submitOrder()

    if (store.isLocalDraft) {
      snackbar.text = 'Журнал заполнен. Оформление заказа будет доступно на следующем шаге.'
      snackbar.color = 'success'
      snackbar.show = true
      return
    }

    snackbar.text = 'Заказ отправлен!'
    snackbar.color = 'success'
    snackbar.show = true
    await router.push({ name: 'account' })
  } catch {
    snackbar.text = store.orderError ?? 'Проверьте обязательные поля'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

onMounted(() => {
  void initialize()
})
</script>

<style scoped lang="scss">
.fill-order {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
}

.fill-order__topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 64px;
  background: rgba($bg-primary, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $border-light;
}

.fill-order__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include page-container;
}

.fill-order__brand {
  font-family: $font-family-display;
  color: $text-primary;
  text-decoration: none;
}

.fill-order__steps-label {
  color: $text-muted;
  font-size: $font-size-body-sm;
}

.fill-order__steps-current {
  color: $text-primary;
  font-weight: $font-weight-semibold;
}

.fill-order__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-block: $spacing-8 0;
}

.fill-order__container {
  @include page-container;
  max-width: 1440px;
  margin-inline: auto;
  padding-bottom: $spacing-6;
}

.fill-order__intro {
  margin-bottom: $spacing-8;
}

.fill-order__eyebrow {
  margin: 0 0 $spacing-2;
  color: $text-secondary;
  font-size: $font-size-caption;
}

.fill-order__title {
  margin: 0 0 $spacing-2;
  font-family: $font-family-display;
  font-size: $font-size-h2;
}

.fill-order__subtitle {
  margin: 0;
  color: $text-secondary;
}

.fill-order__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-12;
  color: $text-secondary;
}

.fill-order__workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 360px;
  gap: 0;
  min-height: 0;
  width: 100%;
  border-top: 1px solid $border-light;

  @include mobile-only {
    grid-template-columns: 1fr;
  }
}

.fill-order__canvas-wrap {
  min-height: 0;
  height: 100%;
}

.fill-order__actions {
  border-top: 1px solid $border-light;
  background: rgba($bg-elevated, 0.96);
  padding-block: $spacing-4;
}

.fill-order__actions-inner {
  @include page-container;
  max-width: 1440px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-4;
}

.fill-order__actions-right {
  display: flex;
  align-items: center;
  gap: $spacing-3;
}

.fill-order__saving {
  font-size: $font-size-body-sm;
  color: $text-muted;
}
</style>
