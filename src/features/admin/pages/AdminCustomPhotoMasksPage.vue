<template>
  <div class="custom-photo-masks-page">
    <div class="custom-photo-masks-page__inner">
      <div class="custom-photo-masks-page__header">
        <div>
          <p class="text-caption text-secondary">Библиотека</p>
          <h1 class="custom-photo-masks-page__title">Свои маски</h1>
          <p class="custom-photo-masks-page__subtitle">
            Пользовательские маски для фото, полученные из SVG-файла. Доступны в редакторе страниц
            в разделе «Фото → Маска».
          </p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Добавить маску
        </v-btn>
      </div>

      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

      <div v-if="!loading && masks.length === 0" class="custom-photo-masks-page__empty">
        <v-icon size="40" color="textDisabled">mdi-shape-outline</v-icon>
        <p>Своих масок пока нет</p>
        <span>Загрузите первую маску из SVG-файла</span>
      </div>

      <div v-else class="custom-photo-masks-page__list">
        <div
          v-for="mask in masks"
          :key="mask.id"
          class="custom-photo-masks-page__item"
          :class="{ 'custom-photo-masks-page__item--dragging': draggingId === mask.id }"
          draggable="true"
          @dragstart="onDragStart(mask.id)"
          @dragover.prevent
          @drop="onDrop(mask.id)"
          @dragend="draggingId = null"
        >
          <div class="custom-photo-masks-page__drag" aria-hidden="true">
            <v-icon size="18">mdi-drag-vertical</v-icon>
          </div>

          <div class="custom-photo-masks-page__preview">
            <div class="custom-photo-masks-page__swatch" :style="{ clipPath: getCustomPhotoMaskCssClipPath(mask.points) }" />
          </div>

          <div class="custom-photo-masks-page__meta">
            <span class="custom-photo-masks-page__name">{{ mask.name }}</span>
            <span class="custom-photo-masks-page__points">{{ mask.points.length }} точек контура</span>
          </div>

          <v-switch
            :model-value="mask.isActive"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="toggleActive(mask, Boolean($event))"
          />

          <div class="custom-photo-masks-page__actions">
            <v-btn
              icon="mdi-pencil-outline"
              size="small"
              variant="text"
              aria-label="Изменить"
              @click="openEdit(mask)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              color="error"
              aria-label="Удалить"
              @click="openDelete(mask)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Create / Edit dialog ═══════════════════════════════════════════ -->
    <v-dialog v-model="formDialog.open" max-width="480" scrollable>
      <v-card>
        <v-card-title>{{ formDialog.editId ? 'Редактировать маску' : 'Новая маска' }}</v-card-title>
        <v-divider />
        <v-card-text>
          <div class="custom-photo-masks-form">
            <v-text-field v-model="form.name" label="Название *" variant="outlined" hide-details="auto" />

            <v-file-input
              label="SVG-файл маски *"
              variant="outlined"
              accept=".svg,image/svg+xml"
              prepend-icon=""
              prepend-inner-icon="mdi-upload"
              hide-details="auto"
              :error-messages="fileError ?? undefined"
              @update:model-value="handleFileChange"
            />

            <div v-if="form.points.length" class="custom-photo-masks-form__preview-wrap">
              <div class="custom-photo-masks-form__preview" :style="{ clipPath: getCustomPhotoMaskCssClipPath(form.points) }" />
            </div>

            <p v-if="form.points.length" class="custom-photo-masks-form__dims">
              Контур распознан: {{ form.points.length }} точек
            </p>

            <v-switch v-model="form.isActive" label="Активна" color="primary" hide-details />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="formDialog.submitting" :disabled="!canSubmit" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ Delete confirmation ════════════════════════════════════════════ -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title>Удалить маску?</v-card-title>
        <v-card-text>Маска «{{ deleteDialog.name }}» будет скрыта и больше не появится в редакторе.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">Отмена</v-btn>
          <v-btn color="error" :loading="deleteDialog.loading" @click="confirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import {
  adminCustomPhotoMasksApi,
  type AdminCustomPhotoMask,
  type AdminCustomPhotoMaskPoint,
} from '@/shared/api/admin/custom-photo-masks.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import { getCustomPhotoMaskCssClipPath } from '@/modules/editor/models/photo-mask.model'
import { parseSvgMaskFile, SvgMaskParseError } from '@/modules/editor/utils/svg-mask-parse.util'

const masks = ref<AdminCustomPhotoMask[]>([])
const loading = ref(false)
const draggingId = ref<string | null>(null)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function loadMasks(): Promise<void> {
  loading.value = true
  try {
    masks.value = await adminCustomPhotoMasksApi.list()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось загрузить маски'), 'error')
  } finally {
    loading.value = false
  }
}

// ── Form dialog ──────────────────────────────────────────────────────────────

const emptyForm = () => ({
  name: '',
  points: [] as AdminCustomPhotoMaskPoint[],
  isActive: true,
})

const form = reactive(emptyForm())
const formDialog = reactive({ open: false, editId: null as string | null, submitting: false })
const fileError = ref<string | null>(null)

const canSubmit = ref(false)
function refreshCanSubmit(): void {
  canSubmit.value = Boolean(form.name.trim() && form.points.length >= 3)
}

async function handleFileChange(fileOrFiles: File | File[] | null): Promise<void> {
  const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles
  fileError.value = null

  if (!file) {
    return
  }

  try {
    const parsed = await parseSvgMaskFile(file)
    form.points = parsed.points
    refreshCanSubmit()
  } catch (err) {
    form.points = []
    fileError.value = err instanceof SvgMaskParseError ? err.message : 'Не удалось разобрать SVG-файл'
    refreshCanSubmit()
  }
}

function openCreate(): void {
  formDialog.editId = null
  Object.assign(form, emptyForm())
  fileError.value = null
  refreshCanSubmit()
  formDialog.open = true
}

function openEdit(mask: AdminCustomPhotoMask): void {
  formDialog.editId = mask.id
  Object.assign(form, {
    name: mask.name,
    points: mask.points,
    isActive: mask.isActive,
  })
  fileError.value = null
  refreshCanSubmit()
  formDialog.open = true
}

async function submitForm(): Promise<void> {
  if (!canSubmit.value) {
    return
  }

  formDialog.submitting = true
  try {
    const payload = {
      name: form.name.trim(),
      points: form.points,
      isActive: form.isActive,
    }

    if (formDialog.editId) {
      await adminCustomPhotoMasksApi.update(formDialog.editId, payload)
      notify('Маска обновлена')
    } else {
      await adminCustomPhotoMasksApi.create(payload)
      notify('Маска создана')
    }

    formDialog.open = false
    await loadMasks()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось сохранить маску'), 'error')
  } finally {
    formDialog.submitting = false
  }
}

async function toggleActive(mask: AdminCustomPhotoMask, isActive: boolean): Promise<void> {
  try {
    await adminCustomPhotoMasksApi.update(mask.id, { isActive })
    mask.isActive = isActive
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить статус маски'), 'error')
  }
}

// ── Delete dialog ────────────────────────────────────────────────────────────

const deleteDialog = reactive({ open: false, id: null as string | null, name: '', loading: false })

function openDelete(mask: AdminCustomPhotoMask): void {
  deleteDialog.id = mask.id
  deleteDialog.name = mask.name
  deleteDialog.open = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteDialog.id) {
    return
  }

  deleteDialog.loading = true
  try {
    await adminCustomPhotoMasksApi.remove(deleteDialog.id)
    deleteDialog.open = false
    notify('Маска удалена')
    await loadMasks()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось удалить маску'), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

// ── Reorder ──────────────────────────────────────────────────────────────────

function onDragStart(id: string): void {
  draggingId.value = id
}

async function onDrop(targetId: string): Promise<void> {
  const sourceId = draggingId.value
  if (!sourceId || sourceId === targetId) {
    return
  }

  const reordered = [...masks.value]
  const fromIndex = reordered.findIndex((mask) => mask.id === sourceId)
  const toIndex = reordered.findIndex((mask) => mask.id === targetId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  masks.value = reordered.map((mask, index) => ({ ...mask, sortOrder: index }))

  try {
    await adminCustomPhotoMasksApi.reorder({
      items: masks.value.map((mask, index) => ({ id: mask.id, sortOrder: index })),
    })
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить порядок'), 'error')
    await loadMasks()
  }
}

onMounted(() => {
  void loadMasks()
})
</script>

<style scoped lang="scss">
.custom-photo-masks-page {
  min-height: 100%;
}

.custom-photo-masks-page__inner {
  @include page-container;
  max-width: 900px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.custom-photo-masks-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
}

.custom-photo-masks-page__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.custom-photo-masks-page__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  max-width: 520px;
}

.custom-photo-masks-page__empty {
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

.custom-photo-masks-page__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.custom-photo-masks-page__item {
  display: grid;
  grid-template-columns: auto 56px 1fr auto auto;
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

.custom-photo-masks-page__drag {
  color: $text-muted;
}

.custom-photo-masks-page__preview {
  width: 48px;
  height: 48px;
  border-radius: $radius-sm;
  overflow: hidden;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 12px 12px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 6px 6px / 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-photo-masks-page__swatch {
  width: 100%;
  height: 100%;
  background: $text-primary;
}

.custom-photo-masks-page__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.custom-photo-masks-page__name {
  font-weight: $font-weight-medium;
}

.custom-photo-masks-page__points {
  font-size: $font-size-caption;
  color: $text-muted;
}

.custom-photo-masks-page__actions {
  display: flex;
  gap: $spacing-1;
}

// ── Form ──────────────────────────────────────────────────────────────────────
.custom-photo-masks-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}

.custom-photo-masks-form__preview-wrap {
  display: flex;
  justify-content: center;
  padding: $spacing-4;
  border-radius: $radius-sm;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 16px 16px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 8px 8px / 16px 16px;
}

.custom-photo-masks-form__preview {
  width: 140px;
  height: 140px;
  background: $text-primary;
}

.custom-photo-masks-form__dims {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
  text-align: center;
}
</style>
