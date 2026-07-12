<template>
  <div class="magazine-pages-tab">
    <div class="magazine-pages-tab__header">
      <div>
        <h2 class="magazine-pages-tab__title">Страницы журнала</h2>
        <p class="magazine-pages-tab__subtitle">
          Каждый тип журнала содержит собственный набор страниц для заполнения пользователем.
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        Добавить страницу
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <div v-if="!loading && pages.length === 0" class="magazine-pages-tab__empty">
      <v-icon size="40" color="textDisabled">mdi-book-open-page-variant-outline</v-icon>
      <p>Страниц пока нет</p>
      <span>Добавьте обложку, развороты и внутренние страницы</span>
    </div>

    <div v-else class="magazine-pages-tab__list">
      <div
        v-for="(page, index) in pages"
        :key="page.id"
        class="magazine-pages-tab__item"
        :class="{ 'magazine-pages-tab__item--dragging': draggingId === page.id }"
        draggable="true"
        @dragstart="onDragStart(page.id)"
        @dragover.prevent
        @drop="onDrop(page.id)"
        @dragend="draggingId = null"
      >
        <div class="magazine-pages-tab__drag" aria-hidden="true">
          <v-icon size="18">mdi-drag-vertical</v-icon>
        </div>

        <div class="magazine-pages-tab__preview">
          <img v-if="page.previewImage" :src="page.previewImage" :alt="page.name" />
          <v-icon v-else size="20" color="textMuted">mdi-file-image-outline</v-icon>
        </div>

        <div class="magazine-pages-tab__meta">
          <span class="magazine-pages-tab__name">{{ page.name }}</span>
          <span class="magazine-pages-tab__type">{{ PAGE_TYPE_LABELS[page.pageType] }}</span>
        </div>

        <span class="magazine-pages-tab__order">{{ index + 1 }}</span>

        <div class="magazine-pages-tab__actions">
          <v-btn
            icon="mdi-draw"
            size="small"
            variant="text"
            aria-label="Редактор"
            @click="openEditor(page.id)"
          />
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn
                icon="mdi-content-copy"
                size="small"
                variant="text"
                aria-label="Дублировать"
                v-bind="menuProps"
              />
            </template>
            <v-list density="compact">
              <v-list-item @click="duplicateSamePage(page)">
                <v-list-item-title>Дублировать</v-list-item-title>
              </v-list-item>
              <v-list-item @click="openDuplicateToType(page)">
                <v-list-item-title>Дублировать в другой тип…</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-btn
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            aria-label="Изменить"
            @click="openEdit(page)"
          />
          <v-btn
            icon="mdi-delete-outline"
            size="small"
            variant="text"
            color="error"
            aria-label="Удалить"
            @click="openDelete(page)"
          />
        </div>
      </div>
    </div>

    <v-dialog v-model="formDialog.open" max-width="480">
      <v-card>
        <v-card-title>{{ formDialog.editId ? 'Редактировать страницу' : 'Новая страница' }}</v-card-title>
        <v-divider />
        <v-card-text>
          <div class="magazine-pages-tab__form">
            <v-text-field v-model="form.name" label="Название *" variant="outlined" hide-details="auto" />
            <v-select
              v-model="form.pageType"
              :items="pageTypeItems"
              item-title="label"
              item-value="value"
              label="Тип страницы"
              variant="outlined"
              hide-details="auto"
            />
            <v-switch v-model="form.isRequired" label="Обязательная страница" color="primary" hide-details />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="formDialog.submitting" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать и открыть редактор' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title>Удалить страницу?</v-card-title>
        <v-card-text>Страница «{{ deleteDialog.name }}» будет скрыта.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">Отмена</v-btn>
          <v-btn color="error" :loading="deleteDialog.loading" @click="confirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <MagazineTypePickerDialog
      v-model="duplicateDialog.open"
      :exclude-id="props.magazineTypeId"
      title="Дублировать страницу в другой тип"
      :loading="duplicateDialog.submitting"
      @confirm="confirmDuplicateToType"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  adminMagazinePagesApi,
  PAGE_TYPE_LABELS,
  type AdminMagazinePage,
  type PageType,
} from '@/shared/api/admin/magazine-pages.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import MagazineTypePickerDialog from './MagazineTypePickerDialog.vue'

const props = defineProps<{
  magazineTypeId: string
}>()

const router = useRouter()
const pages = ref<AdminMagazinePage[]>([])
const loading = ref(false)
const draggingId = ref<string | null>(null)

const pageTypeItems = Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => ({
  value: value as PageType,
  label,
}))

const formDialog = reactive({ open: false, editId: null as string | null, submitting: false })
const deleteDialog = reactive({ open: false, id: null as string | null, name: '', loading: false })
const form = reactive({ name: '', pageType: 'PAGE' as PageType, isRequired: false })

async function loadPages(): Promise<void> {
  loading.value = true
  try {
    pages.value = await adminMagazinePagesApi.list(props.magazineTypeId)
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  formDialog.editId = null
  form.name = ''
  form.pageType = 'PAGE'
  form.isRequired = false
  formDialog.open = true
}

function openEdit(page: AdminMagazinePage): void {
  formDialog.editId = page.id
  form.name = page.name
  form.pageType = page.pageType
  form.isRequired = page.isRequired
  formDialog.open = true
}

function openEditor(pageId: string): void {
  void router.push({
    name: 'admin-magazine-page-editor',
    params: { magazineTypeId: props.magazineTypeId, pageId },
  })
}

function openDelete(page: AdminMagazinePage): void {
  deleteDialog.id = page.id
  deleteDialog.name = page.name
  deleteDialog.open = true
}

async function submitForm(): Promise<void> {
  if (!form.name.trim()) {
    return
  }

  formDialog.submitting = true
  try {
    if (formDialog.editId) {
      await adminMagazinePagesApi.update(props.magazineTypeId, formDialog.editId, {
        name: form.name.trim(),
        pageType: form.pageType,
        isRequired: form.isRequired,
      })
      formDialog.open = false
      await loadPages()
      return
    }

    const created = await adminMagazinePagesApi.create(props.magazineTypeId, {
      name: form.name.trim(),
      pageType: form.pageType,
      isRequired: form.isRequired,
    })
    formDialog.open = false
    openEditor(created.id)
  } finally {
    formDialog.submitting = false
  }
}

async function confirmDelete(): Promise<void> {
  if (!deleteDialog.id) {
    return
  }

  deleteDialog.loading = true
  try {
    await adminMagazinePagesApi.remove(props.magazineTypeId, deleteDialog.id)
    deleteDialog.open = false
    await loadPages()
  } finally {
    deleteDialog.loading = false
  }
}

const duplicateDialog = reactive({
  open: false,
  page: null as AdminMagazinePage | null,
  submitting: false,
})
const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function duplicateSamePage(page: AdminMagazinePage): Promise<void> {
  try {
    await adminMagazinePagesApi.duplicate(props.magazineTypeId, page.id)
    await loadPages()
    notify('Страница продублирована')
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось продублировать страницу'), 'error')
  }
}

function openDuplicateToType(page: AdminMagazinePage): void {
  duplicateDialog.page = page
  duplicateDialog.open = true
}

async function confirmDuplicateToType(targetTypeId: string): Promise<void> {
  if (!duplicateDialog.page) {
    return
  }

  duplicateDialog.submitting = true
  try {
    await adminMagazinePagesApi.duplicate(props.magazineTypeId, duplicateDialog.page.id, targetTypeId)
    duplicateDialog.open = false
    notify('Страница продублирована в другой тип')
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось продублировать страницу'), 'error')
  } finally {
    duplicateDialog.submitting = false
  }
}

function onDragStart(pageId: string): void {
  draggingId.value = pageId
}

async function onDrop(targetId: string): Promise<void> {
  const sourceId = draggingId.value
  if (!sourceId || sourceId === targetId) {
    return
  }

  const reordered = [...pages.value]
  const fromIndex = reordered.findIndex((page) => page.id === sourceId)
  const toIndex = reordered.findIndex((page) => page.id === targetId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  pages.value = reordered.map((page, index) => ({ ...page, sortOrder: index }))

  await adminMagazinePagesApi.reorder(props.magazineTypeId, {
    items: pages.value.map((page, index) => ({ id: page.id, sortOrder: index })),
  })
}

onMounted(() => {
  void loadPages()
})
</script>

<style scoped lang="scss">
.magazine-pages-tab__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
  margin-bottom: $spacing-6;
}

.magazine-pages-tab__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h4;
}

.magazine-pages-tab__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
}

.magazine-pages-tab__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-12;
  border: 1px dashed $border-light;
  border-radius: $radius-md;
  color: $text-muted;
  text-align: center;
}

.magazine-pages-tab__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.magazine-pages-tab__item {
  display: grid;
  grid-template-columns: auto 48px 1fr auto auto;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-3 $spacing-4;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: grab;

  &--dragging {
    opacity: 0.55;
  }
}

.magazine-pages-tab__drag {
  color: $text-muted;
}

.magazine-pages-tab__preview {
  width: 40px;
  height: 52px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-muted;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.magazine-pages-tab__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.magazine-pages-tab__name {
  font-weight: $font-weight-medium;
}

.magazine-pages-tab__type {
  font-size: $font-size-caption;
  color: $text-muted;
}

.magazine-pages-tab__order {
  font-size: $font-size-caption;
  color: $text-secondary;
  min-width: 24px;
  text-align: center;
}

.magazine-pages-tab__actions {
  display: flex;
  gap: $spacing-1;
}

.magazine-pages-tab__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}
</style>
